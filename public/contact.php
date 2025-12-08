<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

$name    = trim($data['name']    ?? '');
$phone   = trim($data['phone']   ?? '');
$email   = trim($data['email']   ?? '');
$message = trim($data['message'] ?? '');

if ($name === '' || $message === '' || ($phone === '' && $email === '')) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Заполните обязательные поля']);
    exit;
}

$to      = 'hello@blagovasweets.ru'; // куда получать
$subject = 'Сообщение с сайта BLAGOVA_SWEETS';

$body = "Новое сообщение с сайта\n\n"
      . "Имя: {$name}\n"
      . "Телефон: {$phone}\n"
      . "Email: {$email}\n\n"
      . "Сообщение:\n{$message}\n";

$fromEmail = 'hello@blagovasweets.ru';
$headers   = "From: BLAGOVA_SWEETS <{$fromEmail}>\r\n"
           . "Content-Type: text/plain; charset=utf-8\r\n";

$ok = mail($to, $subject, $body, $headers);

if ($ok) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Не удалось отправить письмо']);
}
