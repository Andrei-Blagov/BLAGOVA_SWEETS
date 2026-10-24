// CSV quoting + formula neutralization applies to every value, including names
// from frozen product data. UTF-8 BOM and CRLF work in Excel and Sheets.
export function csvCell(value){let s=value==null?'':String(value);if(/^[\s\u0000-\u001f]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function orderCsv(rows,contacts=false){
 const columns=[['reference','Заказ'],['revision','Версия'],['status','Статус'],['source','Источник'],['fulfillment','Получение'],['scheduled_start','Выдача с (Паттайя)'],['scheduled_end','Выдача до (Паттайя)'],['assigned_to','Ответственный ID'],['production_load','Нагрузка'],['items','Состав'],['delivery_minor','Доставка ฿'],['total_minor','Итого ฿'],['is_demo','Тестовый']];
 if(contacts)columns.push(['customer_name','Клиент'],['customer_contact','Контакт'],['delivery_address','Адрес доставки']);
 return '\ufeff'+[columns.map(([,label])=>csvCell(label)).join(','),...rows.map(row=>columns.map(([key])=>csvCell(key.endsWith('_minor')?(Number(row[key])/100).toFixed(2):row[key])).join(','))].join('\r\n')+'\r\n';
}
