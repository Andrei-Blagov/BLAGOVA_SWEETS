export type ProductCategory = 'gingerbread' | 'cake' | 'cupcakes' | 'cookie'

export interface Product {
    id: number
    slug: string
    name: string
    description: string
    price: number
    category: ProductCategory
    image: string
    isPopular?: boolean
    outOfStock?: boolean
    active?: boolean
}

// категории (использовать в меню/фильтрах)
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
        image: '/gingerbread-grandpa.jpg',
        isPopular: true
    },
    {
        id: 2,
        slug: 'gingerbread-grandba',
        name: 'Пряники на торт для бабушки, для мамы, для тёщи',
        description: 'Пряник для бабушки — классический сладкий пряник ручной работы, приготовленный из натуральных ингредиентов.',
        price: 340,
        category: 'gingerbread',
        image: '/gingerbread-grandba.jpg',
        isPopular: true
    },
    {
        id: 3,
        slug: 'gingerbread-grandba-2',
        name: 'Пряники на торт для бабушки, для мамы',
        description: 'Пряники на торт для бабушки, для мамы — классический сладкий пряник ручной работы, приготовленный из натуральных ингредиентов.',
        price: 400,
        category: 'gingerbread',
        image: '/gingerbread-grandba-2.jpg',
        isPopular: true
    },
    {
        id: 4,
        slug: 'gingerbread-man',
        name: 'Пряники топеры на торт мужчине',
        description: 'Пряник «На торт» для него – идеальное сочетание сладости и шутливо-привкусного акцента!',
        price: 281,
        category: 'gingerbread',
        image: '/gingerbread-man.jpg'
    },
    {
        id: 5,
        slug: 'gingerbread-dad',
        name: 'Пряники для торта папе',
        description: 'Пряники топеры на торт папе– душевный подарок для любимого мужчины!',
        price: 256,
        category: 'gingerbread',
        image: '/gingerbread-dad.jpg',
        isPopular: true
    },
    {
        id: 6,
        slug: 'cake-frictes',
        name: 'Торт «Клубничный»',
        description: 'Классический торт, нужен предзаказ.',
        price: 1200,
        category: 'cake',
        image: '/cake-frictes.jpg',
        outOfStock: true,
        isPopular: true
    },
    {
        id: 7,
        slug: 'cake-very-tasty',
        name: 'Очень вкусный торт',
        description: 'Песочная основа, нежная ванильная начинка.',
        price: 1500,
        category: 'cake',
        image: '/cake-very-tasty.png',
        outOfStock: true,
        isPopular: true
    },
    {
        id: 8,
        slug: 'gingerbread-fox',
        name: 'Пряники топеры на торт для девочки Лисёнок',
        description: '🧁 Пряник-топер "Лисёнок" – идеальное украшение для праздничного торта!',
        price: 277,
        category: 'gingerbread',
        image: '/gingerbread-fox.png',
        isPopular: true
    },
    {
        id: 9,
        slug: 'gingerbread-simvol',
        name: 'Пряник на новый год "С Новым годом" с Символом Года',
        description: 'Пряник "С Новым годом" с символом года – традиционный сладкий подарок с душой.',
        price: 307,
        category: 'gingerbread',
        image: '/gingerbread-simvol.png'
    }
]

// удобные выборки (если нужно)
export const popularProducts = products.filter((p) => p.isPopular)
