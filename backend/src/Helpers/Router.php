<?php

declare(strict_types=1);

namespace App\Helpers;

class Router
{
    /** @var array<int, array{method: string, regex: string, handler: callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $regex = preg_replace('#\{[a-zA-Z_]+\}#', '([^/]+)', $pattern);
        $this->routes[] = [
            'method' => $method,
            'regex' => '#^' . $regex . '$#',
            'handler' => $handler,
        ];
    }

    public function get(string $pattern, callable $handler): void
    {
        $this->add('GET', $pattern, $handler);
    }

    public function post(string $pattern, callable $handler): void
    {
        $this->add('POST', $pattern, $handler);
    }

    public function put(string $pattern, callable $handler): void
    {
        $this->add('PUT', $pattern, $handler);
    }

    public function delete(string $pattern, callable $handler): void
    {
        $this->add('DELETE', $pattern, $handler);
    }

    public function dispatch(string $method, string $uri): void
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }
            if (preg_match($route['regex'], $uri, $matches)) {
                array_shift($matches);
                ($route['handler'])(...$matches);
                return;
            }
        }

        Response::error('Not found', 404);
    }
}
