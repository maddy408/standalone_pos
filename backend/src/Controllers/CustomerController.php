<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\UuidHelper;
use App\Helpers\ValidationException;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use PDO;

class CustomerController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(): void
    {
        AuthMiddleware::authenticate();
        $where = 'WHERE 1=1';
        $params = [];
        if (!empty($_GET['search'])) {
            $term = '%' . trim($_GET['search']) . '%';
            $where .= ' AND (name LIKE :s1 OR phone LIKE :s2 OR email LIKE :s3)';
            $params['s1'] = $term;
            $params['s2'] = $term;
            $params['s3'] = $term;
        }
        if (!empty($_GET['updated_since'])) {
            $where .= ' AND created_at > :updated_since';
            $params['updated_since'] = $_GET['updated_since'];
        }
        $stmt = $this->pdo->prepare("SELECT * FROM customers {$where} ORDER BY name ASC LIMIT 1000");
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    public function show(string $id): void
    {
        AuthMiddleware::authenticate();
        $stmt = $this->pdo->prepare('SELECT * FROM customers WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $customer = $stmt->fetch();
        if (!$customer) {
            Response::error('Customer not found', 404);
        }
        Response::json($customer);
    }

    /** Idempotent by uuid — safe to replay from the offline outbox. */
    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'customers.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        [$customer, $status] = $this->createFromSync($body, $claims);
        Response::json($customer, $status);
    }

    /** @param array<string, mixed> $body @param array<string, mixed> $claims @return array{0: array<string, mixed>, 1: int} */
    public function createFromSync(array $body, array $claims): array
    {
        PermissionMiddleware::requireOrThrow($claims, 'customers.manage');
        if (empty($body['name'])) {
            Response::error('Customer name is required', 422);
        }

        $uuid = $body['uuid'] ?? UuidHelper::v4();
        $existing = $this->pdo->prepare('SELECT * FROM customers WHERE uuid = :uuid');
        $existing->execute(['uuid' => $uuid]);
        if ($row = $existing->fetch()) {
            return [$row, 200];
        }

        $openingBalance = (float) ($body['opening_balance'] ?? 0);
        $initialBalance = (float) ($body['balance'] ?? $openingBalance);

        $stmt = $this->pdo->prepare(
            'INSERT INTO customers (uuid, name, phone, email, address, gstin, opening_balance, credit_limit, balance)
             VALUES (:uuid, :name, :phone, :email, :address, :gstin, :opening_balance, :credit_limit, :balance)'
        );
        $stmt->execute([
            'uuid' => $uuid,
            'name' => $body['name'],
            'phone' => $body['phone'] ?? null,
            'email' => $body['email'] ?? null,
            'address' => $body['address'] ?? null,
            'gstin' => $body['gstin'] ?? null,
            'opening_balance' => $openingBalance,
            'credit_limit' => (float) ($body['credit_limit'] ?? 0),
            'balance' => $initialBalance,
        ]);
        $id = (int) $this->pdo->lastInsertId();

        $fetch = $this->pdo->prepare('SELECT * FROM customers WHERE id = :id');
        $fetch->execute(['id' => $id]);
        return [$fetch->fetch(), 201];
    }

    public function update(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'customers.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $stmt = $this->pdo->prepare(
            'UPDATE customers SET name = :name, phone = :phone, email = :email,
             address = :address, gstin = :gstin, credit_limit = :credit_limit,
             opening_balance = :opening_balance
             WHERE id = :id'
        );
        $stmt->execute([
            'name' => $body['name'] ?? '',
            'phone' => $body['phone'] ?? null,
            'email' => $body['email'] ?? null,
            'address' => $body['address'] ?? null,
            'gstin' => $body['gstin'] ?? null,
            'credit_limit' => (float) ($body['credit_limit'] ?? 0),
            'opening_balance' => (float) ($body['opening_balance'] ?? 0),
            'id' => $id,
        ]);

        $fetch = $this->pdo->prepare('SELECT * FROM customers WHERE id = :id');
        $fetch->execute(['id' => $id]);
        Response::json($fetch->fetch());
    }

    public function recordPayment(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'customers.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $amount = (float) ($body['amount'] ?? 0);
        if ($amount <= 0) {
            Response::error('Amount must be positive', 422);
        }

        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare('SELECT balance FROM customers WHERE id = :id FOR UPDATE');
            $stmt->execute(['id' => $id]);
            $c = $stmt->fetch();
            if (!$c) {
                $this->pdo->rollBack();
                Response::error('Customer not found', 404);
            }

            $currentBalance = (float) $c['balance'];
            $invoiceId = !empty($body['invoice_id']) ? (int) $body['invoice_id'] : null;

            // If an invoice is specified, update that invoice's balance as well
            if ($invoiceId) {
                $invStmt = $this->pdo->prepare('SELECT balance_amount, paid_amount FROM invoices WHERE id = :inv_id AND customer_id = :cid FOR UPDATE');
                $invStmt->execute(['inv_id' => $invoiceId, 'cid' => $id]);
                $inv = $invStmt->fetch();
                if ($inv) {
                    $invBalance = (float) $inv['balance_amount'];
                    $invPaid = (float) $inv['paid_amount'];
                    $reduceInv = min($amount, $invBalance);
                    $newInvBalance = max(0.0, $invBalance - $reduceInv);
                    $newInvPaid = $invPaid + $reduceInv;
                    $this->pdo->prepare('UPDATE invoices SET balance_amount = :bal, paid_amount = :paid WHERE id = :inv_id')
                        ->execute(['bal' => $newInvBalance, 'paid' => $newInvPaid, 'inv_id' => $invoiceId]);
                }
            } else {
                // FIFO settlement across open credit invoices of this customer
                $openInvoicesStmt = $this->pdo->prepare('SELECT id, balance_amount, paid_amount FROM invoices WHERE customer_id = :cid AND balance_amount > 0 AND status = "completed" ORDER BY id ASC FOR UPDATE');
                $openInvoicesStmt->execute(['cid' => $id]);
                $openInvoices = $openInvoicesStmt->fetchAll();
                $remainingSettlement = $amount;
                foreach ($openInvoices as $oInv) {
                    if ($remainingSettlement <= 0) break;
                    $oBal = (float) $oInv['balance_amount'];
                    $oPaid = (float) $oInv['paid_amount'];
                    $alloc = min($remainingSettlement, $oBal);
                    $newOBal = max(0.0, $oBal - $alloc);
                    $newOPaid = $oPaid + $alloc;
                    $this->pdo->prepare('UPDATE invoices SET balance_amount = :bal, paid_amount = :paid WHERE id = :inv_id')
                        ->execute(['bal' => $newOBal, 'paid' => $newOPaid, 'inv_id' => $oInv['id']]);
                    $remainingSettlement -= $alloc;
                }
            }

            // Customer balance adjustment:
            // e.g. Customer owed 2500, paid 200 => balance becomes 2300.
            // If customer owed 2500, paid 2700 => balance becomes 0, and extra 200 is credited to Other Income!
            $extraIncome = 0.0;
            if ($amount > $currentBalance && $currentBalance > 0) {
                $extraIncome = $amount - $currentBalance;
                $this->pdo->prepare('UPDATE customers SET balance = 0 WHERE id = :id')
                    ->execute(['id' => $id]);
            } else if ($currentBalance <= 0) {
                // If customer had zero debt and paid extra, the entire amount goes to Income
                $extraIncome = $amount;
            } else {
                $this->pdo->prepare('UPDATE customers SET balance = balance - :amount WHERE id = :id')
                    ->execute(['amount' => $amount, 'id' => $id]);
            }

            $cpayUuid = UuidHelper::v4();
            $this->pdo->prepare(
                'INSERT INTO customer_payments (uuid, customer_id, invoice_id, payment_method_id, amount, notes)
                 VALUES (:uuid, :cid, :inv_id, :pm, :amount, :notes)'
            )->execute([
                'uuid' => $cpayUuid,
                'cid' => $id,
                'inv_id' => $invoiceId,
                'pm' => $body['payment_method_id'] ?? 1,
                'amount' => $amount,
                'notes' => $body['notes'] ?? 'Manual customer credit collection',
            ]);

            // If extra amount was paid above outstanding debt, record directly in income table for profit & reporting!
            if ($extraIncome > 0) {
                $incCatStmt = $this->pdo->query("SELECT id FROM income_categories WHERE name LIKE '%Other%' OR name LIKE '%Credit%' LIMIT 1");
                $incCatId = $incCatStmt ? $incCatStmt->fetchColumn() : null;
                if (!$incCatId) {
                    $this->pdo->exec("INSERT INTO income_categories (name) VALUES ('Customer Extra / Tip Income')");
                    $incCatId = (int) $this->pdo->lastInsertId();
                }

                $this->pdo->prepare(
                    'INSERT INTO income (uuid, category_id, amount, payment_method_id, notes, income_date, user_id)
                     VALUES (:uuid, :cat_id, :amount, :pm, :notes, :income_date, :uid)'
                )->execute([
                    'uuid' => UuidHelper::v4(),
                    'cat_id' => $incCatId,
                    'amount' => $extraIncome,
                    'pm' => $body['payment_method_id'] ?? 1,
                    'notes' => 'Customer Extra Credit Payment (Customer ID #' . $id . ')',
                    'income_date' => date('Y-m-d'),
                    'uid' => $claims['uid'],
                ]);
            }

            $this->pdo->commit();
            Response::json([
                'ok' => true,
                'payment_id' => $this->pdo->lastInsertId(),
                'uuid' => $cpayUuid,
                'extra_income_credited' => $extraIncome
            ]);
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    /** Returns all customer credit collections with customer name, payment method and invoice info. */
    public function paymentsList(): void
    {
        AuthMiddleware::authenticate();
        $where = 'WHERE 1=1';
        $params = [];
        if (!empty($_GET['customer_id'])) {
            $where .= ' AND cp.customer_id = :cid';
            $params['cid'] = (int) $_GET['customer_id'];
        }
        if (!empty($_GET['from'])) {
            $where .= ' AND cp.created_at >= :from';
            $params['from'] = $_GET['from'] . ' 00:00:00';
        }
        if (!empty($_GET['to'])) {
            $where .= ' AND cp.created_at <= :to';
            $params['to'] = $_GET['to'] . ' 23:59:59';
        }

        $stmt = $this->pdo->prepare(
            "SELECT cp.*, c.name AS customer_name, c.phone AS customer_phone,
                    pm.name AS payment_method_name,
                    i.invoice_no
             FROM customer_payments cp
             JOIN customers c ON c.id = cp.customer_id
             LEFT JOIN payment_methods pm ON pm.id = cp.payment_method_id
             LEFT JOIN invoices i ON i.id = cp.invoice_id
             {$where}
             ORDER BY cp.created_at DESC, cp.id DESC
             LIMIT 500"
        );
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }
}
