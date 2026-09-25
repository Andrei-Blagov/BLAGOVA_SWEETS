<script setup lang="ts">
const {
  t
} = useAtelier();
const sent = ref(false);
const company = ref('');
const contact = ref('');
const message = ref('');
const type = ref('hotel');
</script>
<template>
  <section class="shell section">
    <div class="page-intro">
      <span class="eyebrow">GOOD THINGS, TOGETHER</span>
      <h1>{{ t('Ваш бизнес.','Your business.','ธุรกิจของคุณ') }} <em>{{ t('Наше сладкое дело.','Our sweet craft.','ขนมทำมือของเรา') }}</em>
      </h1>
      <p>{{ t('Продумываем партнёрские предложения для отелей, кафе и организаторов событий в Паттайе.','We are shaping partnerships for hotels, cafés and event planners in Pattaya.','เรากำลังเตรียมข้อเสนอสำหรับโรงแรม คาเฟ่ และผู้จัดงานในพัทยา') }}</p>
    </div>
    <div class="partner-grid">
      <article>
        <span class="eyebrow">01 / HOSPITALITY</span>
        <h3>{{ t('Комплимент гостю','A welcome for your guests','ของต้อนรับแขก') }}</h3>
        <p>{{ t('Конфеты в номер, пряники с логотипом и небольшие наборы к особенным датам.','Room chocolates, branded gingerbread and little gifts for special dates.','ช็อกโกแลตในห้องพัก ขนมปังขิงพร้อมโลโก้ และของขวัญสำหรับวันพิเศษ') }}</p>
      </article>
      <article>
        <span class="eyebrow">02 / CAFÉS</span>
        <h3>{{ t('Ваша десертная витрина','Your dessert display','ตู้ขนมของคุณ') }}</h3>
        <p>{{ t('Порционные десерты, капкейки и конфеты для вашего меню. Ассортимент и график согласовываются.','Individual desserts, cupcakes and chocolates for your menu, with an agreed range and schedule.','ขนมชิ้น คัพเค้ก และช็อกโกแลตสำหรับเมนูของคุณ โดยตกลงสินค้าและตารางร่วมกัน') }}</p>
      </article>
      <article>
        <span class="eyebrow">03 / CELEBRATIONS</span>
        <h3>{{ t('Одна тема на весь праздник','One theme, every detail','ธีมเดียวกันทุกรายละเอียด') }}</h3>
        <p>{{ t('Торты, капкейки и персональные подарки для свадеб, дней рождения и корпоративных событий.','Cakes, cupcakes and personal gifts for weddings, birthdays and corporate occasions.','เค้ก คัพเค้ก และของขวัญสำหรับงานแต่ง วันเกิด และกิจกรรมบริษัท') }}</p>
      </article>
    </div>
    <div class="partner-form-wrap">
      <div>
        <span class="eyebrow">LET’S TALK</span>
        <h2>{{ t('Начнём с','It starts with','เริ่มด้วย') }} <em>{{ t('вашей идеи.','your idea.','ไอเดียของคุณ') }}</em>
        </h2>
        <p>{{ t('В прототипе можно проверить форму. Она не отправляет сообщения и не сохраняет контактные данные.','Try the enquiry form in this prototype. It does not send messages or store contact details.','ทดลองแบบฟอร์มในต้นแบบได้ ไม่มีการส่งข้อความหรือบันทึกข้อมูลติดต่อ') }}</p>
      </div>
      <div v-if="sent" class="local-success" role="status">
        <AtelierIcon name="check" :size="32" />
        <h3>{{ t('Форма работает','The form works','แบบฟอร์มทำงานแล้ว') }}</h3>
        <p>{{ t('Это демонстрация. Заявка не отправлена.','This is a demonstration. No enquiry was sent.','นี่เป็นการสาธิต ไม่มีการส่งคำขอ') }}</p>
        <button class="text-link" @click="sent=false">{{ t('Попробовать снова','Try again','ลองอีกครั้ง') }} →</button>
      </div>
      <form v-else @submit.prevent="sent=true">
        <label class="field-label" for="business-name">{{ t('Название компании','Company name','ชื่อบริษัท') }}</label>
        <input id="business-name" v-model="company" required maxlength="100" class="form-input" :placeholder="t('Тестовый отель','Demo hotel','โรงแรมตัวอย่าง')" />
        <label class="field-label" for="business-type">{{ t('Направление','Business type','ประเภทธุรกิจ') }}</label>
        <select id="business-type" v-model="type" class="form-input">
          <option value="hotel">{{ t('Отель / вилла','Hotel / villa','โรงแรม / วิลล่า') }}</option>
          <option value="cafe">{{ t('Кафе / ресторан','Café / restaurant','คาเฟ่ / ร้านอาหาร') }}</option>
          <option value="event">{{ t('Организация событий','Event planning','จัดงาน') }}</option>
        </select>
        <label class="field-label" for="business-contact">{{ t('Тестовый контакт','Sample contact','ข้อมูลติดต่อตัวอย่าง') }}</label>
        <input id="business-contact" v-model="contact" required maxlength="120" class="form-input" placeholder="demo@example.com" />
        <label class="field-label" for="business-message">{{ t('Ваша идея','Your idea','ไอเดียของคุณ') }}</label>
        <textarea id="business-message" v-model="message" required maxlength="1000" class="form-input" rows="3">
        </textarea>
        <button class="btn btn-dark full-width" type="submit">{{ t('Проверить демо-заявку','Try demo enquiry','ทดลองแบบฟอร์ม') }}<AtelierIcon name="arrow" />
        </button>
      </form>
    </div>
  </section>
</template>
