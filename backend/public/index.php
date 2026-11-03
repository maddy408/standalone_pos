<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/database.php';

use App\Controllers\AuditLogController;
use App\Controllers\AuthController;
use App\Controllers\CategoryController;
use App\Controllers\CustomerController;
use App\Controllers\DashboardController;
use App\Controllers\HeldBillController;
use App\Controllers\InvoiceController;
use App\Controllers\LedgerEntryController;
use App\Controllers\LookupController;
use App\Controllers\ProductController;
use App\Controllers\PurchaseController;
use App\Controllers\PermissionController;
use App\Controllers\PurchaseReturnController;
use App\Controllers\ReportController;
use App\Controllers\SalesReturnController;
use App\Controllers\SettingsController;
use App\Controllers\StockController;
use App\Controllers\SupplierController;
use App\Controllers\SyncController;
use App\Controllers\UserController;
use App\Helpers\Response;
use App\Helpers\Router;
use App\Middleware\CorsMiddleware;

CorsMiddleware::handle();

$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';

// Strip a /pos/universal-pos/backend/public prefix when served from a
// sub-path under XAMPP's htdocs rather than its own vhost root.
$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
if ($scriptDir !== '' && str_starts_with($uri, $scriptDir)) {
    $uri = substr($uri, strlen($scriptDir)) ?: '/';
}
if (!str_starts_with($uri, '/api') && $uri !== '/') {
    $uri = '/api' . (str_starts_with($uri, '/') ? $uri : '/' . $uri);
}

$pdo = get_pdo();
$router = new Router();

$router->get('/', fn () => Response::json(['status' => 'ok', 'app' => 'Universal POS API', 'version' => '1.0.0']));
$router->get('/api', fn () => Response::json(['status' => 'ok', 'app' => 'Universal POS API', 'version' => '1.0.0']));

$auth = new AuthController($pdo);
$router->post('/api/auth/login', fn () => $auth->login());
$router->get('/api/auth/me', fn () => $auth->me());

$settings = new SettingsController($pdo);
$router->get('/api/settings', fn () => $settings->show());
$router->put('/api/settings', fn () => $settings->update());
$router->get('/api/settings/attribute-fields', fn () => $settings->attributeFields());

$categories = new CategoryController($pdo);
$router->get('/api/categories', fn () => $categories->index());
$router->post('/api/categories', fn () => $categories->store());
$router->put('/api/categories/{id}', fn ($id) => $categories->update($id));
$router->delete('/api/categories/{id}', fn ($id) => $categories->destroy($id));

$lookup = new LookupController($pdo);
$router->get('/api/lookup/{key}', fn ($key) => $lookup->index($key));
$router->post('/api/lookup/{key}', fn ($key) => $lookup->store($key));
$router->put('/api/lookup/{key}/{id}', fn ($key, $id) => $lookup->update($key, $id));
$router->delete('/api/lookup/{key}/{id}', fn ($key, $id) => $lookup->destroy($key, $id));

$products = new ProductController($pdo);
$router->get('/api/products', fn () => $products->index());
$router->get('/api/products/{id}', fn ($id) => $products->show($id));
$router->post('/api/products', fn () => $products->store());
$router->put('/api/products/{id}', fn ($id) => $products->update($id));
$router->delete('/api/products/{id}', fn ($id) => $products->destroy($id));
$router->get('/api/products/{id}/serials', fn ($id) => $products->serials($id));
$router->post('/api/products/{id}/variants', fn ($id) => $products->storeVariant($id));
$router->put('/api/products/{id}/variants/{variantId}', fn ($id, $variantId) => $products->updateVariant($id, $variantId));
$router->delete('/api/products/{id}/variants/{variantId}', fn ($id, $variantId) => $products->destroyVariant($id, $variantId));

$customers = new CustomerController($pdo);
$router->get('/api/customers', fn () => $customers->index());
$router->get('/api/customers/{id}', fn ($id) => $customers->show($id));
$router->post('/api/customers', fn () => $customers->store());
$router->put('/api/customers/{id}', fn ($id) => $customers->update($id));
$router->delete('/api/customers/{id}', fn ($id) => $customers->destroy($id));
$router->post('/api/customers/{id}/payments', fn ($id) => $customers->recordPayment($id));

$suppliers = new SupplierController($pdo);
$router->get('/api/suppliers', fn () => $suppliers->index());
$router->get('/api/suppliers/{id}', fn ($id) => $suppliers->show($id));
$router->post('/api/suppliers', fn () => $suppliers->store());
$router->put('/api/suppliers/{id}', fn ($id) => $suppliers->update($id));
$router->delete('/api/suppliers/{id}', fn ($id) => $suppliers->destroy($id));
$router->post('/api/suppliers/{id}/payments', fn ($id) => $suppliers->recordPayment($id));

$invoices = new InvoiceController($pdo);
$router->get('/api/invoices', fn () => $invoices->index());
$router->get('/api/invoices/{id}', fn ($id) => $invoices->show($id));
$router->post('/api/invoices', fn () => $invoices->store());
$router->get('/api/invoices/{id}/print', fn ($id) => $invoices->print($id));
$router->post('/api/invoices/{id}/cancel', fn ($id) => $invoices->cancel($id));

$salesReturns = new SalesReturnController($pdo);
$router->get('/api/invoices/{id}/returnable-items', fn ($id) => $salesReturns->returnableItems($id));
$router->get('/api/sales-returns', fn () => $salesReturns->index());
$router->post('/api/sales-returns', fn () => $salesReturns->store());

$purchaseReturns = new PurchaseReturnController($pdo);
$router->get('/api/purchase-returns', fn () => $purchaseReturns->index());
$router->post('/api/purchase-returns', fn () => $purchaseReturns->store());

$held = new HeldBillController($pdo);
$router->get('/api/held-bills', fn () => $held->index());
$router->post('/api/held-bills', fn () => $held->store());
$router->delete('/api/held-bills/{id}', fn ($id) => $held->destroy($id));

$purchases = new PurchaseController($pdo);
$router->get('/api/purchases', fn () => $purchases->index());
$router->get('/api/purchases/{id}', fn ($id) => $purchases->show($id));
$router->post('/api/purchases', fn () => $purchases->store());

$stock = new StockController($pdo);
$router->get('/api/stock/movements', fn () => $stock->movements());
$router->get('/api/stock/low', fn () => $stock->lowStock());
$router->post('/api/stock/adjust', fn () => $stock->adjust());

$ledger = new LedgerEntryController($pdo);
$router->get('/api/expenses', fn () => $ledger->index('expenses'));
$router->post('/api/expenses', fn () => $ledger->store('expenses'));
$router->delete('/api/expenses/{id}', fn ($id) => $ledger->destroy('expenses', $id));
$router->get('/api/income', fn () => $ledger->index('income'));
$router->post('/api/income', fn () => $ledger->store('income'));
$router->delete('/api/income/{id}', fn ($id) => $ledger->destroy('income', $id));

$sync = new SyncController($pdo);
$router->post('/api/sync/push', fn () => $sync->push());
$router->get('/api/sync/pull', fn () => $sync->pull());

$dashboard = new DashboardController($pdo);
$router->get('/api/dashboard/summary', fn () => $dashboard->summary());

$reports = new ReportController($pdo);
$router->get('/api/reports/sales', fn () => $reports->salesReport());
$router->get('/api/reports/purchases', fn () => $reports->purchaseReport());
$router->get('/api/reports/profit-loss', fn () => $reports->profitLoss());
$router->get('/api/reports/inventory', fn () => $reports->inventoryReport());
$router->get('/api/reports/stock-adjustments', fn () => $reports->stockAdjustmentReport());
$router->get('/api/reports/expenses', fn () => $reports->expenseReport());
$router->get('/api/reports/income', fn () => $reports->incomeReport());
$router->get('/api/reports/tax', fn () => $reports->taxReport());
$router->get('/api/reports/customers', fn () => $reports->customerReport());
$router->get('/api/reports/suppliers', fn () => $reports->supplierReport());
$router->get('/api/reports/payments', fn () => $reports->paymentReport());

$users = new UserController($pdo);
$router->get('/api/users', fn () => $users->index());
$router->post('/api/users', fn () => $users->store());
$router->put('/api/users/{id}', fn ($id) => $users->update($id));
$router->delete('/api/users/{id}', fn ($id) => $users->destroy($id));

$permissions = new PermissionController($pdo);
$router->get('/api/permissions', fn () => $permissions->index());
$router->get('/api/role-permissions', fn () => $permissions->roleMatrix());
$router->put('/api/role-permissions', fn () => $permissions->updateRoleMatrix());
$router->get('/api/users/{id}/permissions', fn ($id) => $permissions->userOverrides($id));
$router->put('/api/users/{id}/permissions', fn ($id) => $permissions->setUserOverride($id));

$auditLog = new AuditLogController($pdo);
$router->get('/api/audit-log', fn () => $auditLog->index());
$router->get('/api/audit-log/entity-types', fn () => $auditLog->entityTypes());

$router->dispatch($method, $uri);
