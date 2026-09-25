<script setup lang="ts">
const { products, error: catalogError, load: loadCatalog } = useCatalog();
onMounted(() => loadCatalog());
const {
  t
} = useAtelier();
useSeoMeta({
  title: 'BLAGOVA SWEETS — Little joys, made by hand · Pattaya'
});
</script>
<template>
  <div>
    <section class="shell hero">
      <div class="hero-copy">
        <div class="eyebrow hero-eyebrow">
          <span class="tiny-line">
          </span>{{ t('КОНДИТЕРСКАЯ С ТЁПЛЫМ СЕРДЦЕМ','A PATISSERIE WITH A WARM HEART','ร้านขนมที่เต็มไปด้วยความอบอุ่น') }}</div>
        <h1>{{ t('Счастье —','Happiness,','ความสุข') }}<br>
          <em>{{ t('в маленьком.','in little things.','ในสิ่งเล็ก ๆ') }}</em>
        </h1>
        <p class="hero-description">{{ t('Торты к особенным дням. Шоколад для любимых. Кофе без спешки. Создаём маленькие радости в Паттайе.','Cakes for your special days. Chocolates for your favourite people. Coffee, unhurried. Little joys, made in Pattaya.','เค้กสำหรับวันพิเศษ ช็อกโกแลตสำหรับคนสำคัญ และกาแฟในวันที่ไม่เร่งรีบ ความสุขเล็ก ๆ ในพัทยา') }}</p>
        <div class="button-row">
          <NuxtLink to="/menu" class="btn btn-dark">{{ t('Выбрать свою радость','Find your little joy','เลือกความสุขของคุณ') }}<AtelierIcon name="arrow" />
          </NuxtLink>
          <NuxtLink to="/celebration" class="text-link">{{ t('У меня праздник','I have a celebration','ฉันมีงานฉลอง') }}<AtelierIcon name="diagonal" :size="16" />
          </NuxtLink>
        </div>
        <div class="hero-footnote">
          <span class="mini-flower">✳</span>
          <span>{{ t('РУЧНАЯ РАБОТА. ЛИЧНЫЕ ИСТОРИИ.','HANDMADE TREATS. PERSONAL STORIES.','ขนมทำมือ เรื่องราวของคุณ') }}</span>
        </div>
      </div>
      <div class="hero-visual">
        <img class="hero-photo" src="/prototype/cake.webp" :alt="t('Концепция ягодного торта на керамической подставке','Concept of an artisan berry cake on a ceramic stand','ภาพแนวคิดเค้กเบอร์รีบนแท่นเซรามิก')" width="1536" height="1024" fetchpriority="high" />
        <div class="round-stamp">
          <span>MADE WITH</span>
          <AtelierIcon name="heart" :size="25" />
          <span>A LITTLE LOVE</span>
        </div>
        <div class="photo-caption">
          <span>01 / THE BERRY CLOUD</span>
          <span>{{ t('КОНЦЕПЦИЯ КОЛЛЕКЦИИ','COLLECTION CONCEPT','แนวคิดคอลเลกชัน') }}</span>
        </div>
      </div>
    </section>
    <div class="values-strip">
      <div class="shell">
        <span>
          <AtelierIcon name="heart" />{{ t('Сделано вручную','Made by hand','ทำด้วยมือ') }}</span>
        <span>
          <AtelierIcon name="gift" />{{ t('Подарки с характером','Gifts with personality','ของขวัญที่มีเอกลักษณ์') }}</span>
        <span>
          <AtelierIcon name="coffee" />{{ t('Место для тёплых встреч','A place to come together','พื้นที่แห่งการพบปะ') }}</span>
        <span>
          <AtelierIcon name="pin" />Pattaya, Thailand</span>
      </div>
    </div>
    <section class="shell section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">{{ t('НАША ПЕРВАЯ КОЛЛЕКЦИЯ','OUR FIRST COLLECTION','คอลเลกชันแรกของเรา') }}</span>
          <h2>{{ t('На любой','For every','สำหรับทุก') }} <em>{{ t('сладкий момент.','sweet moment.','ช่วงเวลาแสนหวาน') }}</em>
          </h2>
        </div>
        <NuxtLink to="/menu" class="text-link">{{ t('Все десерты','Explore all treats','ดูขนมทั้งหมด') }}<AtelierIcon name="arrow" />
        </NuxtLink>
      </div>
      <div class="product-grid home-product-grid">
        <AtelierProduct v-for="product in products.slice(0,4)" :key="product.id" :product="product" />
      </div>
      <p v-if="catalogError" role="alert">{{ catalogError }}</p>
    </section>
    <section class="gift-story shell">
      <div class="gift-story-photo">
        <img src="/prototype/gift.webp" :alt="t('Подарочная коробка конфет и пряников','A gift box of bonbons and gingerbread','กล่องของขวัญช็อกโกแลตและขนมปังขิง')" loading="lazy" width="1536" height="1024" />
      </div>
      <div class="gift-story-copy">
        <span class="eyebrow">A LITTLE BOX OF LOVE</span>
        <h2>{{ t('Скажите больше.','Say a little more.','บอกความรู้สึก') }}<br>
          <em>{{ t('Подарите сладкое.','Give something sweet.','ด้วยความหวาน') }}</em>
        </h2>
        <p>{{ t('Любимые вкусы, нежная лента и несколько слов от вас. Соберите коробку, которая расскажет вашу историю.','Favourite flavours, a beautiful ribbon and a few words from you. Build a box that tells your own story.','รสชาติที่ชอบ ริบบิ้นสวย ๆ และข้อความจากคุณ จัดกล่องที่บอกเล่าเรื่องราวของคุณ') }}</p>
        <NuxtLink to="/gift-box" class="btn btn-dark">{{ t('Собрать мой подарок','Build my gift box','จัดกล่องของขวัญ') }}<AtelierIcon name="arrow" />
        </NuxtLink>
        <div class="small-steps">
          <span>01 {{ t('Выберите','Choose','เลือก') }}</span>
          <span>02 {{ t('Добавьте слова','Make it personal','เพิ่มข้อความ') }}</span>
          <span>03 {{ t('Подарите','Make someone smile','มอบความสุข') }}</span>
        </div>
      </div>
    </section>
    <section class="shell section celebration-teaser">
      <div class="eyebrow">{{ t('ДЛЯ ВАШИХ ОСОБЕННЫХ ДНЕЙ','FOR YOUR SPECIAL DAYS','สำหรับวันพิเศษของคุณ') }}</div>
      <h2>{{ t('Один праздник.','One celebration.','หนึ่งงานฉลอง') }}<br>
        <em>{{ t('Много маленьких радостей.','So many little joys.','ความสุขเล็ก ๆ มากมาย') }}</em>
      </h2>
      <p>{{ t('Торт, капкейки и именные пряники в одном настроении. Укажите число гостей — мы поможем собрать комплект.','A cake, cupcakes and personalised cookies, all in one beautiful theme. Tell us your guest count and build your celebration set.','เค้ก คัพเค้ก และคุกกี้เฉพาะบุคคลในธีมเดียวกัน เลือกจำนวนแขกและจัดชุดงานฉลอง') }}</p>
      <NuxtLink to="/celebration" class="btn btn-outline">{{ t('Спланировать праздник','Plan a celebration','วางแผนงานฉลอง') }}<AtelierIcon name="arrow" />
      </NuxtLink>
    </section>
    <section class="cafe-story">
      <img src="/prototype/cafe.webp" :alt="t('Визуальная концепция будущей кофейни','Visual concept of the future café','ภาพแนวคิดคาเฟ่ในอนาคต')" loading="lazy" width="1536" height="1024" />
      <div class="cafe-story-card">
        <span class="eyebrow">SLOW MORNINGS, SWEET MEMORIES</span>
        <h2>{{ t('Немного кофе.','A little coffee.','กาแฟสักแก้ว') }}<br>
          <em>{{ t('Немного ближе.','A little closer.','ใกล้กันอีกนิด') }}</em>
        </h2>
        <p>{{ t('Мечтаем о небольшом месте в Паттайе, куда хочется заглянуть за десертом и остаться ещё на чашечку.','We are dreaming up a little place in Pattaya. Come for a dessert. Stay for one more cup.','เรากำลังสร้างพื้นที่เล็ก ๆ ในพัทยา แวะมาทานขนม แล้วอยู่ต่ออีกสักแก้ว') }}</p>
        <NuxtLink to="/cafe" class="text-link">{{ t('О будущей кофейне','Meet our future café','รู้จักคาเฟ่ในอนาคต') }}<AtelierIcon name="arrow" />
        </NuxtLink>
      </div>
    </section>
    <section class="shell partner-teaser">
      <div>
        <span class="eyebrow">LET’S MAKE SOMETHING LOVELY</span>
        <h3>{{ t('Ваша история. Наши десерты.','Your story. Our sweets.','เรื่องราวของคุณ ขนมของเรา') }}</h3>
        <p>{{ t('Для отелей, кафе и тех, кто создаёт события.','For hotels, cafés and people who bring occasions to life.','สำหรับโรงแรม คาเฟ่ และผู้จัดงาน') }}</p>
      </div>
      <NuxtLink to="/cooperation" class="btn btn-outline">{{ t('Стать партнёром','Become a partner','ร่วมเป็นพันธมิตร') }}<AtelierIcon name="diagonal" />
      </NuxtLink>
    </section>
  </div>
</template>
