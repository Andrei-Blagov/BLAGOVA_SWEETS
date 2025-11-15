// data/products.ts

export type ProductCategory = 'bread' | 'croissant' | 'cake' | 'bun' | 'cookie'

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

// категории (можно использовать в меню/фильтрах)
export const PRODUCT_CATEGORIES: { id: ProductCategory | 'all'; label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'bread', label: 'Хлеб' },
    { id: 'croissant', label: 'Круассаны' },
    { id: 'cake', label: 'Торты' },
    { id: 'bun', label: 'Булочки' },
    { id: 'cookie', label: 'Печенье' }
]

// единый массив продуктов
export const products: Product[] = [
    {
        id: 1,
        slug: 'baguette-classic',
        name: 'Багет классический',
        description: 'Пшеничная мука, хрустящая корочка, мягкий мякиш.',
        price: 150,
        category: 'bread',
        image: '/bread-1.jpg',
        isPopular: true
    },
    {
        id: 2,
        slug: 'rye-bread',
        name: 'Ржаной хлеб',
        description: 'Богатый вкус, идеально к супам.',
        price: 160,
        category: 'bread',
        image: '/bread-2.jpg'
    },
    {
        id: 3,
        slug: 'croissant-almond',
        name: 'Круассан миндальный',
        description: 'Слоёное тесто, миндальный крем, сахарная пудра.',
        price: 220,
        category: 'croissant',
        image: '/croissant-1.jpg',
        isPopular: true
    },
    {
        id: 4,
        slug: 'croissant-chocolate',
        name: 'Круассан шоколадный',
        description: 'Начинка из тёмного шоколада.',
        price: 210,
        category: 'croissant',
        image: '/croissant-2.jpg'
    },
    {
        id: 5,
        slug: 'ciabatta-rosemary',
        name: 'Чиабатта с розмарином',
        description: 'Итальянский хлеб с оливковым маслом и розмарином.',
        price: 180,
        category: 'bread',
        image: '/ciabatta-1.jpg',
        isPopular: true
    },
    {
        id: 6,
        slug: 'cake-napoleon',
        name: 'Торт «Наполеон»',
        description: 'Классический торт, нужен предзаказ.',
        price: 1200,
        category: 'cake',
        image: '/cake-1.jpg',
        outOfStock: true
    },
    {
        id: 7,
        slug: 'cake-cheesecake-vanilla',
        name: 'Чизкейк ванильный',
        description: 'Песочная основа, нежная ванильная начинка.',
        price: 950,
        category: 'cake',
        image: '/cake-2.jpg'
    },
    {
        id: 8,
        slug: 'bun-cinnamon',
        name: 'Булочка с корицей',
        description: 'Сдобное тесто с корицей и глазурью.',
        price: 120,
        category: 'bun',
        image: '/bun-1.jpg',
        isPopular: true
    },
    {
        id: 9,
        slug: 'cookie-chocolate',
        name: 'Печенье шоколадное',
        description: 'Мягкое печенье с кусочками шоколада.',
        price: 90,
        category: 'cookie',
        image: '/cookie-1.jpg'
    }
]

// удобные выборки (если нужно)
export const popularProducts = products.filter((p) => p.isPopular)
