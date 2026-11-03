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

        $todaySalesStmt = $this->pdo->prepare(
            "SELECT COALESCE(SUM(grand_total),0) AS total, COUNT(*) AS count FROM invoices
             WHERE status = 'completed' AND DATE(created_at) = :today"
        );
        $todaySalesStmt->execute(['today' => $today]);
        $todaySales = $todaySalesStmt->fetch();

        $lowStock = $this->pdo->query(
            "SELECT COUNT(*) FROM products p, business_settings s
             WHERE p.is_active = 1 AND p.track_serial = 0
               AND p.stock_qty <= COALESCE(p.low_stock_threshold, s.low_stock_threshold)"
        )->fetchColumn();

        $outstandingCustomers = $this->pdo->query('SELECT COALESCE(SUM(balance),0) FROM customers')->fetchColumn();
        $outstandingSuppliers = $this->pdo->query('SELECT COALESCE(SUM(balance),0) FROM suppliers')->fetchColumn();
        $productCount = $this->pdo->query('SELECT COUNT(*) FROM products WHERE is_active = 1')->fetchColumn();

        Response::json([
            'today_sales_total' => (float) $todaySales['total'],
            'today_invoice_count' => (int) $todaySales['count'],
            'low_stock_count' => (int) $lowStock,
            'outstanding_from_customers' => (float) $outstandingCustomers,
            'outstanding_to_suppliers' => (float) $outstandingSuppliers,
            'product_count' => (int) $productCount,
        ]);
    }
}
