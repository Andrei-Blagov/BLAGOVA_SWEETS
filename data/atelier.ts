export type Locale = 'ru' | 'en' | 'th';
export type Localized = Record<Locale, string>;
export const L = (ru: string, en: string, th: string): Localized => ({
  ru,
  en,
  th
});
export interface AtelierProduct {
  id: string;
  name: Localized;
  subtitle: Localized;
  description: Localized;
  category: 'cakes' | 'cupcakes' | 'gingerbread' | 'chocolate';
  image: string;
  price: number;
  unit: Localized;
  leadDays: number;
  allergens: Localized;
}
export const atelierProducts: AtelierProduct[] = [{
  id: 'berry-cloud',
  name: L('Ягодное облако', 'Berry cloud', 'เค้กเบอร์รีคลาวด์'),
  subtitle: L('Ваниль · малина · нежный крем', 'Vanilla · raspberry · light cream', 'วานิลลา · ราสป์เบอร์รี · ครีม'),
  description: L('Воздушный ванильный бисквит, ягодная прослойка и мягкий сливочный крем. Небольшой повод собраться за одним столом.', 'Soft vanilla sponge, a bright berry centre and delicate cream. A little reason to gather around the same table.', 'เค้กวานิลลาเนื้อนุ่ม สอดไส้เบอร์รีและครีมละมุน สำหรับช่วงเวลาพิเศษร่วมกัน'),
  category: 'cakes',
  image: '/prototype/cake.webp',
  price: 1450,
  unit: L('1 кг · 6–8 порций', '1 kg · 6–8 servings', '1 กก. · 6–8 ที่'),
  leadDays: 2,
  allergens: L('Пшеница, молоко, яйца. Возможны следы орехов.', 'Wheat, milk, eggs. May contain traces of nuts.', 'มีข้าวสาลี นม ไข่ และอาจมีถั่วปนเปื้อน')
}, {
  id: 'raspberry-kisses',
  name: L('Малиновые поцелуи', 'Raspberry kisses', 'ราสป์เบอร์รีคิสเซส'),
  subtitle: L('Капкейки с ягодным сердцем', 'Cupcakes with a berry heart', 'คัพเค้กไส้เบอร์รี'),
  description: L('Шесть маленьких десертов с ванильным бисквитом и малиновой начинкой. Для подарка, чаепития или просто хорошего дня.', 'Six little vanilla cakes with a raspberry centre. Made for a thoughtful gift, afternoon coffee or an ordinary lovely day.', 'คัพเค้กวานิลลาหกชิ้น ไส้ราสป์เบอร์รี เหมาะเป็นของขวัญหรือทานคู่กาแฟ'),
  category: 'cupcakes',
  image: '/prototype/cupcakes.webp',
  price: 590,
  unit: L('набор 6 шт.', 'box of 6', 'กล่อง 6 ชิ้น'),
  leadDays: 1,
  allergens: L('Пшеница, молоко, яйца.', 'Wheat, milk, eggs.', 'มีข้าวสาลี นม และไข่')
}, {
  id: 'chocolate-stories',
  name: L('Шоколадные истории', 'Chocolate stories', 'ช็อกโกแลตสตอรีส์'),
  subtitle: L('Авторские конфеты ручной работы', 'Handcrafted chocolate bonbons', 'ช็อกโกแลตบงบงทำมือ'),
  description: L('Шесть конфет: тёмный шоколад, малина и фисташка. Тонкая оболочка и мягкая начинка, которую хочется распробовать.', 'Six handmade bonbons: dark chocolate, raspberry and pistachio. A delicate shell with a soft, rich centre.', 'บงบงหกชิ้น รสดาร์กช็อกโกแลต ราสป์เบอร์รี และพิสตาชิโอ เปลือกบาง ไส้นุ่ม'),
  category: 'chocolate',
  image: '/prototype/gift.webp',
  price: 490,
  unit: L('набор 6 шт.', 'box of 6', 'กล่อง 6 ชิ้น'),
  leadDays: 0,
  allergens: L('Молоко, фисташки, соя. Возможны следы других орехов.', 'Milk, pistachios, soy. May contain other nuts.', 'มีนม พิสตาชิโอ ถั่วเหลือง และอาจมีถั่วชนิดอื่น')
}, {
  id: 'gingerbread-heart',
  name: L('Тёплые слова', 'Sweet little words', 'คำหวานจากใจ'),
  subtitle: L('Имбирные пряники с вашей надписью', 'Personalised gingerbread cookies', 'คุกกี้ขนมปังขิงพร้อมข้อความ'),
  description: L('Пряники с тёплыми специями, нежной глазурью и вашим пожеланием. Добавьте имя или короткую фразу — и подарок станет личным.', 'Gingerbread cookies with warm spices, delicate icing and a message of your own. A name or a little wish makes it personal.', 'คุกกี้ขนมปังขิงหอมเครื่องเทศ แต่งไอซิงและข้อความส่วนตัว เพื่อของขวัญที่พิเศษ'),
  category: 'gingerbread',
  image: '/photos_of_products/gingerbread-heart.webp',
  price: 280,
  unit: L('набор 2 шт.', 'set of 2', 'ชุด 2 ชิ้น'),
  leadDays: 2,
  allergens: L('Пшеница, молоко, яйца.', 'Wheat, milk, eggs.', 'มีข้าวสาลี นม และไข่')
}, {
  id: 'birthday-cupcakes',
  name: L('Маленький праздник', 'Little celebration', 'งานฉลองเล็ก ๆ'),
  subtitle: L('Капкейки в цветах вашего события', 'Cupcakes in your celebration colours', 'คัพเค้กในสีสันที่คุณเลือก'),
  description: L('Тематический набор капкейков. Выберите надпись и настроение: детали оформления согласовываются отдельно.', 'A themed cupcake set with your own message and mood. Final design details are agreed with the pastry chef.', 'ชุดคัพเค้กตามธีม พร้อมข้อความของคุณ รายละเอียดการตกแต่งต้องยืนยันกับเชฟ'),
  category: 'cupcakes',
  image: '/prototype/cupcakes.webp',
  price: 690,
  unit: L('набор 6 шт.', 'box of 6', 'กล่อง 6 ชิ้น'),
  leadDays: 2,
  allergens: L('Пшеница, молоко, яйца.', 'Wheat, milk, eggs.', 'มีข้าวสาลี นม และไข่')
}, {
  id: 'celebration-cake',
  name: L('Ваш особенный день', 'Your special day', 'วันพิเศษของคุณ'),
  subtitle: L('Торт с персональной надписью', 'A cake with your own message', 'เค้กพร้อมข้อความส่วนตัว'),
  description: L('Ванильно-ягодный торт к вашему событию. Добавьте короткую надпись и выберите вес. Фото показывает концепцию оформления.', 'A vanilla and berry cake for your celebration. Add a short message and choose a size. The photo is a design concept.', 'เค้กวานิลลาเบอร์รีสำหรับงานพิเศษ เพิ่มข้อความและเลือกขนาด ภาพเป็นแนวคิดการตกแต่ง'),
  category: 'cakes',
  image: '/prototype/cake.webp',
  price: 1650,
  unit: L('1 кг · 6–8 порций', '1 kg · 6–8 servings', '1 กก. · 6–8 ที่'),
  leadDays: 3,
  allergens: L('Пшеница, молоко, яйца. Возможны следы орехов.', 'Wheat, milk, eggs. May contain traces of nuts.', 'มีข้าวสาลี นม ไข่ และอาจมีถั่วปนเปื้อน')
}];
export const categories = [{
  id: 'all',
  name: L('Все десерты', 'All treats', 'ขนมทั้งหมด')
}, {
  id: 'cakes',
  name: L('Торты', 'Cakes', 'เค้ก')
}, {
  id: 'cupcakes',
  name: L('Капкейки', 'Cupcakes', 'คัพเค้ก')
}, {
  id: 'gingerbread',
  name: L('Пряники', 'Gingerbread', 'ขนมปังขิง')
}, {
  id: 'chocolate',
  name: L('Шоколад', 'Chocolate', 'ช็อกโกแลต')
}];
