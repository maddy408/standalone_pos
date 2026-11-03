<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use PDO;

class ReportController
{
    public function __construct(private PDO $pdo)
    {
    }

    /** @return array{0: string, 1: string} [from, to] inclusive date bounds, defaulting to the current month. */
    private function dateRange(): array
    {
        $from = $_GET['from'] ?? date('Y-m-01');
        $to = $_GET['to'] ?? date('Y-m-d');
        return [$from, $to . ' 23:59:59'];
    }

    public function salesReport(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        [$from, $to] = $this->dateRange();

        $totals = $this->pdo->prepare(
            "SELECT COUNT(*) AS invoice_count, COALESCE(SUM(subtotal),0) AS subtotal,
                    COALESCE(SUM(discount_amount),0) AS discount, COALESCE(SUM(tax_amount),0) AS tax,
                    COALESCE(SUM(grand_total),0) AS grand_total
             FROM invoices WHERE status = 'completed' AND created_at BETWEEN :from AND :to"
        );
        $totals->execute(['from' => $from, 'to' => $to]);

        $byDay = $this->pdo->prepare(
            "SELECT DATE(created_at) AS day, COUNT(*) AS invoice_count, COALESCE(SUM(grand_total),0) AS total
             FROM invoices WHERE status = 'completed' AND created_at BETWEEN :from AND :to
             GROUP BY DATE(created_at) ORDER BY day"
        );
        $byDay->execute(['from' => $from, 'to' => $to]);

        $byProduct = $this->pdo->prepare(
            "SELECT p.name AS product_name, SUM(ii.qty) AS qty_sold, SUM(ii.line_total) AS total
             FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id AND i.status = 'completed' AND i.created_at BETWEEN :from AND :to
             LEFT JOIN products p ON p.id = ii.product_id
             GROUP BY ii.product_id, p.name ORDER BY total DESC LIMIT 50"
        );
        $byProduct->execute(['from' => $from, 'to' => $to]);

        Response::json([
            'totals' => $totals->fetch(),
            'by_day' => $byDay->fetchAll(),
            'by_product' => $byProduct->fetchAll(),
        ]);
    }

    public function purchaseReport(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        [$from, $to] = $this->dateRange();

        $totals = $this->pdo->prepare(
            "SELECT COUNT(*) AS purchase_count, COALESCE(SUM(grand_total),0) AS grand_total,
                    COALESCE(SUM(paid_amount),0) AS paid_amount, COALESCE(SUM(balance_amount),0) AS balance_amount
             FROM purchases WHERE status = 'completed' AND created_at BETWEEN :from AND :to"
        );
        $totals->execute(['from' => $from, 'to' => $to]);

        $list = $this->pdo->prepare(
            "SELECT p.purchase_no, s.name AS supplier_name, p.grand_total, p.paid_amount, p.balance_amount, p.created_at
             FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
             WHERE p.status = 'completed' AND p.created_at BETWEEN :from AND :to
             ORDER BY p.created_at DESC"
        );
        $list->execute(['from' => $from, 'to' => $to]);

        Response::json(['totals' => $totals->fetch(), 'list' => $list->fetchAll()]);
    }

    public function profitLoss(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        [$from, $to] = $this->dateRange();

        // Gross profit = sale line totals minus the product's purchase cost at the time of sale.
        $sales = $this->pdo->prepare(
            "SELECT COALESCE(SUM(ii.line_total),0) AS revenue,
                    COALESCE(SUM(ii.qty * p.purchase_price),0) AS cost_of_goods
             FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id AND i.status = 'completed' AND i.created_at BETWEEN :from AND :to
             LEFT JOIN products p ON p.id = ii.product_id"
        );
        $sales->execute(['from' => $from, 'to' => $to]);
        $salesRow = $sales->fetch();

        $expenses = $this->pdo->prepare(
            "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE expense_date BETWEEN :from AND :to"
        );
        $expenses->execute(['from' => substr($from, 0, 10), 'to' => substr($to, 0, 10)]);
        $totalExpenses = (float) $expenses->fetchColumn();

        $otherIncome = $this->pdo->prepare(
            "SELECT COALESCE(SUM(amount),0) FROM income WHERE income_date BETWEEN :from AND :to"
        );
        $otherIncome->execute(['from' => substr($from, 0, 10), 'to' => substr($to, 0, 10)]);
        $totalOtherIncome = (float) $otherIncome->fetchColumn();

        $revenue = (float) $salesRow['revenue'];
        $cogs = (float) $salesRow['cost_of_goods'];
        $grossProfit = $revenue - $cogs;
        $netProfit = $grossProfit + $totalOtherIncome - $totalExpenses;

        Response::json([
            'revenue' => $revenue,
            'cost_of_goods' => $cogs,
            'gross_profit' => $grossProfit,
            'other_income' => $totalOtherIncome,
            'expenses' => $totalExpenses,
            'net_profit' => $netProfit,
        ]);
    }

    public function inventoryReport(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        $stmt = $this->pdo->query(
            "SELECT p.id, p.name, p.business_type, p.stock_qty, p.purchase_price, p.selling_price,
                    (p.stock_qty * p.purchase_price) AS stock_value_at_cost,
                    (p.stock_qty * p.selling_price) AS stock_value_at_price
             FROM products p WHERE p.is_active = 1 ORDER BY p.name"
        );
        $rows = $stmt->fetchAll();
        $totalCost = array_sum(array_column($rows, 'stock_value_at_cost'));
        $totalPrice = array_sum(array_column($rows, 'stock_value_at_price'));

        Response::json(['items' => $rows, 'total_value_at_cost' => $totalCost, 'total_value_at_price' => $totalPrice]);
    }

    public function stockAdjustmentReport(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        [$from, $to] = $this->dateRange();
        $stmt = $this->pdo->prepare(
            "SELECT sm.*, p.name AS product_name, u.full_name AS user_name
             FROM stock_movements sm
             JOIN products p ON p.id = sm.product_id
             LEFT JOIN users u ON u.id = sm.user_id
             WHERE sm.movement_type = 'adjustment' AND sm.created_at BETWEEN :from AND :to
             ORDER BY sm.created_at DESC"
        );
        $stmt->execute(['from' => $from, 'to' => $to]);
        Response::json($stmt->fetchAll());
    }

    public function expenseReport(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        [$from, $to] = $this->dateRange();
        $stmt = $this->pdo->prepare(
            "SELECT ec.name AS category_name, COALESCE(SUM(e.amount),0) AS total, COUNT(*) AS count
             FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.category_id
             WHERE e.expense_date BETWEEN :from AND :to GROUP BY e.category_id, ec.name ORDER BY total DESC"
        );
        $stmt->execute(['from' => substr($from, 0, 10), 'to' => substr($to, 0, 10)]);
        Response::json($stmt->fetchAll());
    }

    public function incomeReport(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        [$from, $to] = $this->dateRange();
        $stmt = $this->pdo->prepare(
            "SELECT ic.name AS category_name, COALESCE(SUM(i.amount),0) AS total, COUNT(*) AS count
             FROM income i LEFT JOIN income_categories ic ON ic.id = i.category_id
             WHERE i.income_date BETWEEN :from AND :to GROUP BY i.category_id, ic.name ORDER BY total DESC"
        );
        $stmt->execute(['from' => substr($from, 0, 10), 'to' => substr($to, 0, 10)]);
        Response::json($stmt->fetchAll());
    }

    public function taxReport(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        [$from, $to] = $this->dateRange();
        $stmt = $this->pdo->prepare(
            "SELECT t.name AS tax_name, t.percent, COALESCE(SUM(ii.tax_amount),0) AS tax_collected,
                    COALESCE(SUM(ii.line_total),0) AS taxable_sales
             FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id AND i.status = 'completed' AND i.created_at BETWEEN :from AND :to
             LEFT JOIN products p ON p.id = ii.product_id
             LEFT JOIN tax_rates t ON t.id = p.tax_rate_id
             GROUP BY t.id, t.name, t.percent ORDER BY tax_collected DESC"
        );
        $stmt->execute(['from' => $from, 'to' => $to]);
        Response::json($stmt->fetchAll());
    }

    public function customerReport(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        $stmt = $this->pdo->query(
            "SELECT c.id, c.name, c.phone, c.balance,
                    COALESCE((SELECT SUM(grand_total) FROM invoices WHERE customer_id = c.id AND status = 'completed'), 0) AS lifetime_sales
             FROM customers c ORDER BY c.balance DESC"
        );
        Response::json($stmt->fetchAll());
    }

    public function supplierReport(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        $stmt = $this->pdo->query(
            "SELECT s.id, s.name, s.phone, s.balance,
                    COALESCE((SELECT SUM(grand_total) FROM purchases WHERE supplier_id = s.id AND status = 'completed'), 0) AS lifetime_purchases
             FROM suppliers s ORDER BY s.balance DESC"
        );
        Response::json($stmt->fetchAll());
    }

    public function paymentReport(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        [$from, $to] = $this->dateRange();
        $stmt = $this->pdo->prepare(
            "SELECT pm.name AS method_name, COALESCE(SUM(ip.amount),0) AS total, COUNT(*) AS count
             FROM invoice_payments ip
             JOIN payment_methods pm ON pm.id = ip.payment_method_id
             JOIN invoices i ON i.id = ip.invoice_id AND i.status = 'completed' AND i.created_at BETWEEN :from AND :to
             GROUP BY pm.id, pm.name ORDER BY total DESC"
        );
        $stmt->execute(['from' => $from, 'to' => $to]);
        Response::json($stmt->fetchAll());
    }
}
