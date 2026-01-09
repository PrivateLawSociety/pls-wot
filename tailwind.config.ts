import type { Config } from 'tailwindcss';

export default {
	content: [
		'./src/**/*.{html,js,svelte,ts}',
		'./node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}'
	],

	darkMode: 'class',

	theme: {
		extend: {
			colors: {
				// flowbite-svelte
				primary: {
					50: '#C27803',
					100: '#C27803',
					200: '#C27803',
					300: '#C27803',
					400: '#F59E0B',
					500: '#F59E0B',
					600: '#D97706',
					700: '#B45309',
					800: '#92400E',
					900: '#78350F'
				},
				wot_blue: {
					50: '#89A1D1',
					100: '#4373D1'
				}
			}
		}
	},

	plugins: [require('flowbite/plugin')]
} as Config;
