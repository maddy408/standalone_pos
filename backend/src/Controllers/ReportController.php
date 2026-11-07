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

        Response::json([
            'totals' => $totals->fetch(),
            'by_day' => $byDay->fetchAll(),
        ]);
    }

    /** Shared column list for every "Sales Reports" sub-tab — gross/discount/gst/net
     *  use the same formula everywhere: invoice_items.line_total is already
     *  qty*unit_price - discount + tax, i.e. the final net amount for that line. */
    private const SALES_AGGREGATE_SQL = "SUM(ii.qty) AS quantity,
            SUM(ii.qty * ii.unit_price) AS gross_sales,
            SUM(ii.discount_amount) AS discount,
            SUM(ii.tax_amount) AS gst,
            SUM(ii.line_total) AS net_sales";

    /** @return array{0: string, 1: array<string, mixed>} [productFilterSql, params] for an optional ?business_type= scope. */
    private function productScope(array $baseParams): array
    {
        if (!empty($_GET['business_type'])) {
            $baseParams['bt'] = $_GET['business_type'];
            return [' AND p.business_type = :bt', $baseParams];
        }
        return ['', $baseParams];
    }

    /**
     * Business-type-wise sales — Universal POS's substitute for KC Agency's
     * Branch Wise report (Universal POS has no branches, only business_type).
     */
    public function salesByBusinessType(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        [$from, $to] = $this->dateRange();

        $main = $this->pdo->prepare(
            "SELECT COALESCE(p.business_type, 'other') AS business_type,
                    COUNT(DISTINCT i.id) AS bills, COUNT(DISTINCT ii.id) AS items,
                    " . self::SALES_AGGREGATE_SQL . "
             FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id AND i.status = 'completed' AND i.created_at BETWEEN :from AND :to
             LEFT JOIN products p ON p.id = ii.product_id
             GROUP BY COALESCE(p.business_type, 'other')
             ORDER BY net_sales DESC"
        );
        $main->execute(['from' => $from, 'to' => $to]);
        $rows = $main->fetchAll();

        // Paid/credit attributed per invoice (by its first product's business_type), then
        // summed per group — computed separately via a derived table to stay
        // compatible with ONLY_FULL_GROUP_BY (a correlated subquery referencing
        // the outer grouped column trips that mode on some MySQL/MariaDB builds).
        $paymentsStmt = $this->pdo->prepare(
            "SELECT bt AS business_type, SUM(paid_amount) AS paid_amount, SUM(balance_amount) AS credit_amount
             FROM (
                SELECT i.id, COALESCE(MIN(p.business_type), 'other') AS bt,
                       MAX(i.paid_amount) AS paid_amount, MAX(i.balance_amount) AS balance_amount
                FROM invoices i
                JOIN invoice_items ii ON ii.invoice_id = i.id
                LEFT JOIN products p ON p.id = ii.product_id
                WHERE i.status = 'completed' AND i.created_at BETWEEN :from AND :to
                GROUP BY i.id
             ) x
             GROUP BY bt"
        );
        $paymentsStmt->execute(['from' => $from, 'to' => $to]);
        $byType = [];
        foreach ($paymentsStmt->fetchAll() as $r) {
            $byType[$r['business_type']] = $r;
        }

        foreach ($rows as &$row) {
            $extra = $byType[$row['business_type']] ?? ['paid_amount' => 0, 'credit_amount' => 0];
            $row['paid_amount'] = $extra['paid_amount'];
            $row['credit_amount'] = $extra['credit_amount'];
        }
        Response::json($rows);
    }

    public function salesByCustomer(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        [$from, $to] = $this->dateRange();

        $main = $this->pdo->prepare(
            "SELECT COALESCE(i.customer_id, 0) AS customer_code, COALESCE(c.name, 'Walk-in') AS customer_name,
                    COUNT(DISTINCT i.id) AS bills, COUNT(DISTINCT ii.id) AS items,
                    " . self::SALES_AGGREGATE_SQL . "
             FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id AND i.status = 'completed' AND i.created_at BETWEEN :from AND :to
             LEFT JOIN customers c ON c.id = i.customer_id
             GROUP BY COALESCE(i.customer_id, 0), c.name
             ORDER BY net_sales DESC"
        );
        $main->execute(['from' => $from, 'to' => $to]);
        $rows = $main->fetchAll();

        $paymentsStmt = $this->pdo->prepare(
            "SELECT COALESCE(customer_id, 0) AS customer_code,
                    SUM(paid_amount) AS paid_amount, SUM(balance_amount) AS credit_amount
             FROM invoices
             WHERE status = 'completed' AND created_at BETWEEN :from AND :to
             GROUP BY COALESCE(customer_id, 0)"
        );
        $paymentsStmt->execute(['from' => $from, 'to' => $to]);
        $byCustomer = [];
        foreach ($paymentsStmt->fetchAll() as $r) {
            $byCustomer[$r['customer_code']] = $r;
        }

        foreach ($rows as &$row) {
            $extra = $byCustomer[$row['customer_code']] ?? ['paid_amount' => 0, 'credit_amount' => 0];
            $row['paid_amount'] = $extra['paid_amount'];
            $row['credit_amount'] = $extra['credit_amount'];
        }
        Response::json($rows);
    }

    public function salesBySupplier(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        [$from, $to] = $this->dateRange();
        [$filter, $params] = $this->productScope(['from' => $from, 'to' => $to]);
        $stmt = $this->pdo->prepare(
            "SELECT COALESCE(s.name, 'No Supplier') AS supplier_name,
                    COUNT(DISTINCT ii.id) AS items_sold, " . self::SALES_AGGREGATE_SQL . "
             FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id AND i.status = 'completed' AND i.created_at BETWEEN :from AND :to
             LEFT JOIN products p ON p.id = ii.product_id
             LEFT JOIN suppliers s ON s.id = p.supplier_id
             WHERE 1=1 {$filter}
             GROUP BY COALESCE(s.id, 0), COALESCE(s.name, 'No Supplier')
             ORDER BY net_sales DESC"
        );
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    public function salesByBrand(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        [$from, $to] = $this->dateRange();
        [$filter, $params] = $this->productScope(['from' => $from, 'to' => $to]);
        $stmt = $this->pdo->prepare(
            "SELECT COALESCE(b.name, 'No Brand') AS brand_name,
                    COUNT(DISTINCT ii.id) AS items_sold, " . self::SALES_AGGREGATE_SQL . "
             FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id AND i.status = 'completed' AND i.created_at BETWEEN :from AND :to
             LEFT JOIN products p ON p.id = ii.product_id
             LEFT JOIN brands b ON b.id = p.brand_id
             WHERE 1=1 {$filter}
             GROUP BY COALESCE(b.id, 0), COALESCE(b.name, 'No Brand')
             ORDER BY net_sales DESC"
        );
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    public function salesByCategory(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        [$from, $to] = $this->dateRange();
        [$filter, $params] = $this->productScope(['from' => $from, 'to' => $to]);
        $byCategory = $this->pdo->prepare(
            "SELECT COALESCE(parent.name, c.name, 'Uncategorized') AS category_name,
                    COUNT(DISTINCT ii.id) AS items_sold, " . self::SALES_AGGREGATE_SQL . "
             FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id AND i.status = 'completed' AND i.created_at BETWEEN :from AND :to
             LEFT JOIN products p ON p.id = ii.product_id
             LEFT JOIN categories c ON c.id = p.category_id
             LEFT JOIN categories parent ON parent.id = c.parent_id
             WHERE 1=1 {$filter}
             GROUP BY category_name ORDER BY net_sales DESC"
        );
        $byCategory->execute($params);

        $bySubcategory = $this->pdo->prepare(
            "SELECT c.name AS subcategory_name, parent.name AS parent_category_name,
                    COUNT(DISTINCT ii.id) AS items_sold, " . self::SALES_AGGREGATE_SQL . "
             FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id AND i.status = 'completed' AND i.created_at BETWEEN :from AND :to
             LEFT JOIN products p ON p.id = ii.product_id
             JOIN categories c ON c.id = p.category_id AND c.parent_id IS NOT NULL
             LEFT JOIN categories parent ON parent.id = c.parent_id
             WHERE 1=1 {$filter}
             GROUP BY c.id, c.name, parent.name ORDER BY net_sales DESC"
        );
        $bySubcategory->execute($params);

        Response::json(['by_category' => $byCategory->fetchAll(), 'by_subcategory' => $bySubcategory->fetchAll()]);
    }

    public function salesByBrandCategory(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        [$from, $to] = $this->dateRange();
        [$filter, $params] = $this->productScope(['from' => $from, 'to' => $to]);
        $stmt = $this->pdo->prepare(
            "SELECT COALESCE(b.name, 'No Brand') AS brand_name, COALESCE(c.name, 'Uncategorized') AS category_name,
                    COUNT(DISTINCT ii.id) AS items_sold, " . self::SALES_AGGREGATE_SQL . "
             FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id AND i.status = 'completed' AND i.created_at BETWEEN :from AND :to
             LEFT JOIN products p ON p.id = ii.product_id
             LEFT JOIN brands b ON b.id = p.brand_id
             LEFT JOIN categories c ON c.id = p.category_id
             WHERE 1=1 {$filter}
             GROUP BY COALESCE(b.id, 0), COALESCE(b.name, 'No Brand'), COALESCE(c.id, 0), COALESCE(c.name, 'Uncategorized')
             ORDER BY net_sales DESC"
        );
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    public function salesByItem(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        [$from, $to] = $this->dateRange();
        [$filter, $params] = $this->productScope(['from' => $from, 'to' => $to]);
        $stmt = $this->pdo->prepare(
            "SELECT COALESCE(p.name, ii.product_name_snapshot, 'Custom Item') AS item_name,
                    p.sku, p.barcode, COALESCE(b.name, 'No Brand') AS brand_name,
                    COALESCE(c.name, 'Uncategorized') AS category_name, COALESCE(s.name, 'No Supplier') AS supplier_name,
                    " . self::SALES_AGGREGATE_SQL . "
             FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id AND i.status = 'completed' AND i.created_at BETWEEN :from AND :to
             LEFT JOIN products p ON p.id = ii.product_id
             LEFT JOIN brands b ON b.id = p.brand_id
             LEFT JOIN categories c ON c.id = p.category_id
             LEFT JOIN suppliers s ON s.id = p.supplier_id
             WHERE 1=1 {$filter}
             GROUP BY ii.product_id, item_name, p.sku, p.barcode, brand_name, category_name, supplier_name
             ORDER BY net_sales DESC LIMIT 500"
        );
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
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
        $where = 'WHERE p.is_active = 1';
        $params = [];
        if (!empty($_GET['business_type'])) {
            $where .= ' AND p.business_type = :bt';
            $params['bt'] = $_GET['business_type'];
        }
        $stmt = $this->pdo->prepare(
            "SELECT p.id, p.name, p.business_type, p.stock_qty, p.purchase_price, p.selling_price,
                    (p.stock_qty * p.purchase_price) AS stock_value_at_cost,
                    (p.stock_qty * p.selling_price) AS stock_value_at_price
             FROM products p {$where} ORDER BY p.name"
        );
        $stmt->execute($params);
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
        $where = "WHERE sm.movement_type = 'adjustment' AND sm.created_at BETWEEN :from AND :to";
        $params = ['from' => $from, 'to' => $to];
        if (!empty($_GET['business_type'])) {
            $where .= ' AND p.business_type = :bt';
            $params['bt'] = $_GET['business_type'];
        }
        $stmt = $this->pdo->prepare(
            "SELECT sm.*, p.name AS product_name, u.full_name AS user_name
             FROM stock_movements sm
             JOIN products p ON p.id = sm.product_id
             LEFT JOIN users u ON u.id = sm.user_id
             {$where}
             ORDER BY sm.created_at DESC"
        );
        $stmt->execute($params);
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
        $productFilter = '';
        $params = ['from' => $from, 'to' => $to];
        if (!empty($_GET['business_type'])) {
            $productFilter = ' AND p.business_type = :bt';
            $params['bt'] = $_GET['business_type'];
        }
        $stmt = $this->pdo->prepare(
            "SELECT t.name AS tax_name, t.percent, COALESCE(SUM(ii.tax_amount),0) AS tax_collected,
                    COALESCE(SUM(ii.line_total),0) AS taxable_sales
             FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id AND i.status = 'completed' AND i.created_at BETWEEN :from AND :to
             LEFT JOIN products p ON p.id = ii.product_id
             LEFT JOIN tax_rates t ON t.id = p.tax_rate_id
             WHERE 1=1 {$productFilter}
             GROUP BY t.id, t.name, t.percent ORDER BY tax_collected DESC"
        );
        $stmt->execute($params);
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

    /**
     * Customer credit aging, adapted from KC Agency's Credit Outstanding
     * report (there: per-branch; here: shop-wide, since Universal POS has
     * no branches). Aging is by the customer's oldest unpaid invoice, same
     * single-bucket approach as the source report.
     */
    public function creditOutstandingReport(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        $stmt = $this->pdo->query(
            "SELECT c.id, c.name AS customer_name, c.phone, c.credit_limit,
                    COALESCE(SUM(i.balance_amount), 0) AS total_outstanding,
                    MIN(i.created_at) AS oldest_unpaid_date,
                    DATEDIFF(CURDATE(), MIN(i.created_at)) AS days_overdue
             FROM customers c
             JOIN invoices i ON i.customer_id = c.id AND i.status = 'completed' AND i.balance_amount > 0.009
             GROUP BY c.id, c.name, c.phone, c.credit_limit
             ORDER BY days_overdue DESC"
        );
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['over_limit'] = ((float) $row['total_outstanding'] > (float) $row['credit_limit'] && (float) $row['credit_limit'] > 0) ? 'Yes' : 'No';
        }
        Response::json($rows);
    }

    /**
     * Invoice-level tax register, adapted from KC Agency's GST/Non-GST
     * registers. Universal POS invoices have no GST-registered vs.
     * non-GST split (every invoice is taxed the same way via each line's
     * tax_rate_id), so this is a single unified register rather than two.
     */
    public function taxRegisterReport(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'reports.view');
        [$from, $to] = $this->dateRange();
        $stmt = $this->pdo->prepare(
            "SELECT i.invoice_no, i.created_at, COALESCE(c.name, 'Walk-in') AS customer_name,
                    i.subtotal AS taxable_value, i.tax_amount, i.grand_total, i.status
             FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
             WHERE i.created_at BETWEEN :from AND :to
             ORDER BY i.created_at, i.id
             LIMIT 5000"
        );
        $stmt->execute(['from' => $from, 'to' => $to]);
        Response::json($stmt->fetchAll());
    }
}
