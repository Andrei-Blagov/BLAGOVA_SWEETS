export type ProductCategory = 'gingerbread' | 'cake' | 'cupcakes' | 'cookie'

export interface Product {
    id: number
    slug: string
    name: string
    description: string
    price: number
    category: ProductCategory
    mainImage: string
    images?: string[]
    isPopular?: boolean
    outOfStock?: boolean
    active?: boolean
}

// категории (в меню/фильтрах)
export const PRODUCT_CATEGORIES: { id: ProductCategory | 'all'; label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'gingerbread', label: 'Пряники' },
    { id: 'cake', label: 'Торты' },
    { id: 'cupcakes', label: 'Капкейки' },
    { id: 'cookie', label: 'Печенье' }
]

// единый массив продуктов для разработки
export const products: Product[] = [
    {
        id: 1,
        slug: 'gingerbread-grandpa',
        name: 'Пряники на торт для Дедушки',
        description: 'Пряник для дедушки — классический сладкий пряник ручной работы, приготовленный из натуральных ингредиентов.',
        price: 281,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-grandpa.webp',
        images: ['/photos_of_products/gingerbread-grandpa.webp', '/photos_of_products/gingerbread-grandpa_2.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 2,
        slug: 'gingerbread-grandba',
        name: 'Пряники на торт для бабушки, для мамы, для тёщи',
        description: 'Пряник для бабушки — классический сладкий пряник ручной работы, приготовленный из натуральных ингредиентов.',
        price: 340,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-grandba.webp',
        images: ['/photos_of_products/gingerbread-grandba.webp', '/photos_of_products/gingerbread-grandba_2.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 3,
        slug: 'gingerbread-grandba-new',
        name: 'Пряники на торт для бабушки, для мамы',
        description: 'Пряники на торт для бабушки, для мамы — классический сладкий пряник ручной работы, приготовленный из натуральных ингредиентов.',
        price: 400,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-grandba-new.webp',
        images: ['/photos_of_products/gingerbread-grandba-new.webp', '/photos_of_products/gingerbread-grandba-new_2.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 4,
        slug: 'gingerbread-man',
        name: 'Пряники топеры на торт мужчине',
        description: 'Пряник «На торт» для него – идеальное сочетание сладости и шутливо-привкусного акцента!',
        price: 281,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-man.webp',
        images: ['/photos_of_products/gingerbread-man.webp', '/photos_of_products/gingerbread-man_2.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 5,
        slug: 'gingerbread-dad',
        name: 'Пряники для торта папе',
        description: 'Пряники топеры на торт папе– душевный подарок для любимого мужчины!',
        price: 256,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-dad.webp',
        images: ['/photos_of_products/gingerbread-dad.webp', '/photos_of_products/gingerbread-dad_2.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 6,
        slug: 'gingerbread-fox',
        name: 'Пряники топеры на торт для девочки Лисёнок',
        description: '🧁 Пряник-топер "Лисёнок" – идеальное украшение для праздничного торта!',
        price: 277,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-fox.webp',
        images: ['/photos_of_products/gingerbread-fox.webp', '/photos_of_products/gingerbread-fox_2.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 7,
        slug: 'gingerbread-simvol',
        name: 'Пряник на новый год "С Новым годом" с Символом Года',
        description: 'Пряник "С Новым годом" с символом года – традиционный сладкий подарок с душой.',
        price: 307,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-simvol.webp',
        images: ['/photos_of_products/gingerbread-simvol.webp', '/photos_of_products/gingerbread-simvol_2.webp', '/photos_of_products/gingerbread-simvol_3.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 8,
        slug: 'gingerbread-heart',
        name: 'Пряники топеры на торт для девочки Лисёнок',
        description: '🧁 Пряник-топер "Лисёнок" – идеальное украшение для праздничного торта!',
        price: 277,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-heart.webp',
        images: ['/photos_of_products/gingerbread-heart.webp', '/photos_of_products/gingerbread-heart_2.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 9,
        slug: 'gingerbread-rabbit',
        name: 'Пряник на новый год "С Новым годом" с Символом Года',
        description: 'Пряник "С Новым годом" с символом года – традиционный сладкий подарок с душой.',
        price: 307,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-rabbit.webp',
        images: ['/photos_of_products/gingerbread-rabbit.webp', '/photos_of_products/gingerbread-rabbit_2.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 10,
        slug: 'gingerbread-boy14',
        name: 'Пряник на новый год "С Новым годом" с Символом Года',
        description: 'Пряник "С Новым годом" с символом года – традиционный сладкий подарок с душой.',
        price: 307,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-boy14.webp',
        images: ['/photos_of_products/gingerbread-boy14.webp', '/photos_of_products/gingerbread-boy14_2.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 11,
        slug: 'gingerbread-girl-hbd',
        name: 'Пряник на новый год "С Новым годом" с Символом Года',
        description: 'Пряник "С Новым годом" с символом года – традиционный сладкий подарок с душой.',
        price: 307,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-girl-hbd.webp',
        images: ['/photos_of_products/gingerbread-girl-hbd.webp', '/photos_of_products/gingerbread-girl-hbd_2.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 12,
        slug: 'gingerbread-girlfriend',
        name: 'Пряник на новый год "С Новым годом" с Символом Года',
        description: 'Пряник "С Новым годом" с символом года – традиционный сладкий подарок с душой.',
        price: 307,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-girlfriend.webp',
        images: ['/photos_of_products/gingerbread-girlfriend.webp', '/photos_of_products/gingerbread-girlfriend_2.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 13,
        slug: 'gingerbread-hny-balls',
        name: 'Пряник на новый год "С Новым годом" с Символом Года',
        description: 'Пряник "С Новым годом" с символом года – традиционный сладкий подарок с душой.',
        price: 307,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-hny-balls.webp',
        images: ['/photos_of_products/gingerbread-hny-balls.webp', '/photos_of_products/gingerbread-hny-balls_2.webp', '/photos_of_products/gingerbread-hny-balls_3.webp', '/photos_of_products/gingerbread-hny-balls_4.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 14,
        slug: 'gingerbread-unicorn',
        name: 'Пряник на новый год "С Новым годом" с Символом Года',
        description: 'Пряник "С Новым годом" с символом года – традиционный сладкий подарок с душой.',
        price: 307,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-unicorn.webp',
        images: ['/photos_of_products/gingerbread-unicorn.webp', '/photos_of_products/gingerbread-unicorn_2.webp', '/photos_of_products/gingerbread-unicorn_3.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 15,
        slug: 'gingerbread-hny-tangerines',
        name: 'Пряник на новый год "С Новым годом" с Символом Года',
        description: 'Пряник "С Новым годом" с символом года – традиционный сладкий подарок с душой.',
        price: 307,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-hny-tangerines.webp',
        images: ['/photos_of_products/gingerbread-hny-tangerines.webp', '/photos_of_products/gingerbread-hny-tangerines_2.webp', '/photos_of_products/gingerbread-hny-tangerines_3.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 16,
        slug: 'gingerbread-simvol',
        name: 'Пряник на новый год "С Новым годом" с Символом Года',
        description: 'Пряник "С Новым годом" с символом года – традиционный сладкий подарок с душой.',
        price: 307,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-simvol.webp',
        images: ['/photos_of_products/gingerbread-simvol.webp', '/photos_of_products/gingerbread-simvol_2.webp', '/photos_of_products/gingerbread-simvol_3.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 17,
        slug: 'gingerbread-simvol',
        name: 'Пряник на новый год "С Новым годом" с Символом Года',
        description: 'Пряник "С Новым годом" с символом года – традиционный сладкий подарок с душой.',
        price: 307,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-simvol.webp',
        images: ['/photos_of_products/gingerbread-simvol.webp', '/photos_of_products/gingerbread-simvol_2.webp', '/photos_of_products/gingerbread-simvol_3.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 18,
        slug: 'gingerbread-simvol',
        name: 'Пряник на новый год "С Новым годом" с Символом Года',
        description: 'Пряник "С Новым годом" с символом года – традиционный сладкий подарок с душой.',
        price: 307,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-simvol.webp',
        images: ['/photos_of_products/gingerbread-simvol.webp', '/photos_of_products/gingerbread-simvol_2.webp', '/photos_of_products/gingerbread-simvol_3.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 19,
        slug: 'gingerbread-simvol',
        name: 'Пряник на новый год "С Новым годом" с Символом Года',
        description: 'Пряник "С Новым годом" с символом года – традиционный сладкий подарок с душой.',
        price: 307,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-simvol.webp',
        images: ['/photos_of_products/gingerbread-simvol.webp', '/photos_of_products/gingerbread-simvol_2.webp', '/photos_of_products/gingerbread-simvol_3.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 20,
        slug: 'gingerbread-simvol',
        name: 'Пряник на новый год "С Новым годом" с Символом Года',
        description: 'Пряник "С Новым годом" с символом года – традиционный сладкий подарок с душой.',
        price: 307,
        category: 'gingerbread',
        mainImage: '/photos_of_products/gingerbread-simvol.webp',
        images: ['/photos_of_products/gingerbread-simvol.webp', '/photos_of_products/gingerbread-simvol_2.webp', '/photos_of_products/gingerbread-simvol_3.webp'],
        isPopular: true,
        outOfStock: false
    },
    {
        id: 21,
        slug: 'cake-frictes',
        name: 'Торт «Клубничный»',
        description: 'Классический торт, нужен предзаказ.',
        price: 1200,
        category: 'cake',
        mainImage: '/photos_of_products/cake-frictes.webp',
        isPopular: true,
        outOfStock: false
    },
    {
        id: 22,
        slug: 'cake-very-tasty',
        name: 'Очень вкусный торт',
        description: 'Песочная основа, нежная ванильная начинка.',
        price: 1500,
        category: 'cake',
        mainImage: '/photos_of_products/cake-very-tasty.webp',
        isPopular: true,
        outOfStock: false
    }
]

// удобные выборки
export const popularProducts = products.filter((p) => p.isPopular)
