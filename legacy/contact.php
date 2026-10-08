<?php
header('Content-Type: application/json; charset=utf-8');

// Разрешаем только POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Читаем JSON
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

// 1) Письмо ВАМ (на общий адрес пекарни)
$toAdmin    = 'contact@blagovasweets.ru';     // куда получать сообщения с формы
$fromEmail  = 'hello@blagovasweets.ru';       // с какого адреса отправляем (должен быть на вашем домене)
$subjectAdm = 'Сообщение с сайта BLAGOVA_SWEETS';

$bodyAdm = "Новое сообщение с сайта BLAGOVA_SWEETS\n\n"
         . "Имя: {$name}\n"
         . "Телефон: {$phone}\n"
         . "Email: {$email}\n\n"
         . "Сообщение:\n{$message}\n";

$headersAdm = "From: BLAGOVA_SWEETS <{$fromEmail}>\r\n"
            . "Content-Type: text/plain; charset=utf-8\r\n";
// можно добавить Reply-To, если указан e-mail
if ($email !== '') {
    $headersAdm .= "Reply-To: {$email}\r\n";
}

$okAdmin = mail($toAdmin, $subjectAdm, $bodyAdm, $headersAdm);

// 2) Письмо ПОЛЬЗОВАТЕЛЮ (подтверждение) — только если он указал e-mail
$okUser = true;

if ($email !== '') {
    $subjectUser = 'Мы получили ваше сообщение — BLAGOVA_SWEETS';

    $bodyUser = "Здравствуйте, {$name}!\n\n"
              . "Спасибо за обращение в семейную пекарню BLAGOVA_SWEETS.\n"
              . "Мы получили ваше сообщение и свяжемся с вами в ближайшее время.\n\n"
              . "Ваше сообщение:\n"
              . "{$message}\n\n"
              . "С уважением,\n"
              . "команда BLAGOVA_SWEETS";

    $headersUser = "From: BLAGOVA_SWEETS <{$fromEmail}>\r\n"
                 . "Content-Type: text/plain; charset=utf-8\r\n";

    $okUser = mail($email, $subjectUser, $bodyUser, $headersUser);
}

// В ответе фронту считаем успех по письму администратору
if ($okAdmin) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Не удалось отправить письмо']);
}
