import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        './components/**/*.{vue,js,ts}',
        './layouts/**/*.vue',
        './pages/**/*.vue',
        './app.vue'
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    100: '#FFF3E1',
                    500: '#E6A15B',
                    600: '#D18A3D',
                    800: '#3E276A'
                },
                neutral: {
                    50: '#F9FAFB',
                    200: '#E5E7EB',
                    600: '#4B5563',
                    900: '#1F2933'
                },
                accent: {
                    green: '#46A86D',
                    red: '#E74C3C'
                }
            },
            boxShadow: {
                card: '0 8px 20px rgba(15, 23, 42, 0.08)'
            },
            borderRadius: {
                sm: '8px',
                md: '16px',
                pill: '999px'
            },
            container: {
                center: true,
                padding: '1rem'
            }
        }
    },
    plugins: []
}

export default config
