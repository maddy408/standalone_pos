<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use PDO;

class DashboardController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function summary(): void
    {
        AuthMiddleware::authenticate();
        $today = date('Y-m-d');

        // Realized Cash Collected Today:
        // Invoices store the paid_amount directly (which gets updated when collection payments are applied).
        // Plus any extra income/collection payments that were not tied to invoices.
        $todayInvoicePaidStmt = $this->pdo->prepare(
            "SELECT COALESCE(SUM(paid_amount), 0) AS total, COUNT(*) AS count FROM invoices
             WHERE status = 'completed' AND DATE(created_at) = :today"
        );
        $todayInvoicePaidStmt->execute(['today' => $today]);
        $todayInvoicePaid = $todayInvoicePaidStmt->fetch();

        // Direct Realized Total is simply the total paid across completed invoices
        $todayRealizedTotal = (float) $todayInvoicePaid['total'];

        $lowStock = $this->pdo->query(
            "SELECT COUNT(*) FROM products p, business_settings s
             WHERE p.is_active = 1 AND p.track_serial = 0
               AND p.stock_qty <= COALESCE(p.low_stock_threshold, s.low_stock_threshold)"
        )->fetchColumn();

        $outstandingCustomers = $this->pdo->query('SELECT COALESCE(SUM(balance),0) FROM customers')->fetchColumn();
        $outstandingSuppliers = $this->pdo->query('SELECT COALESCE(SUM(balance),0) FROM suppliers')->fetchColumn();
        $productCount = $this->pdo->query('SELECT COUNT(*) FROM products WHERE is_active = 1')->fetchColumn();

        Response::json([
            'today_sales_total' => $todayRealizedTotal,
            'today_invoice_count' => (int) $todayInvoicePaid['count'],
            'low_stock_count' => (int) $lowStock,
            'outstanding_from_customers' => (float) $outstandingCustomers,
            'outstanding_to_suppliers' => (float) $outstandingSuppliers,
            'product_count' => (int) $productCount,
        ]);
    }
}
