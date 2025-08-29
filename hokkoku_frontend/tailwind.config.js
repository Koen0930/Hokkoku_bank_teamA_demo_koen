/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
        xl: `calc(var(--radius) + 4px)`,
        '2xl': `calc(var(--radius) + 8px)`,
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        brand: {
          50: '#f0faff',
          100: '#e0f4ff',
          200: '#b9e9ff',
          300: '#7ccfff',
          400: '#36b0ff',
          500: '#008cff',
          600: '#0070e0',
          700: '#0058c2',
          800: '#0049a1',
          900: '#003f87',
          950: '#002a5c',
        },
  			primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
  				50: '#f0f4ff',
  				100: '#e5edff',
  				200: '#cddbfe',
  				300: '#b4c6fc',
  				400: '#8da2fb',
  				500: '#6366f1',
  				600: '#4f46e5',
  				700: '#4338ca',
  				800: '#3730a3',
  				900: '#312e81',
  				950: '#1e1b4b'
  			},
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
  			accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
  				50: '#f0f9ff',
  				100: '#e0f2fe',
  				200: '#bae6fd',
  				300: '#7dd3fc',
  				400: '#38bdf8',
  				500: '#0ea5e9',
  				600: '#0284c7',
  				700: '#0369a1',
  				800: '#075985',
  				900: '#0c4a6e'
  			},
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
  			neutral: {
  				50: '#f9fafb',
  				100: '#f3f4f6',
  				200: '#e5e7eb',
  				300: '#d1d5db',
  				400: '#9ca3af',
  				500: '#6b7280',
  				600: '#4b5563',
  				700: '#374151',
  				800: '#1f2937',
  				900: '#111827',
  				950: '#030712'
  			},
  			success: {
  				50: '#f0fdf4',
  				100: '#dcfce7',
  				200: '#bbf7d0',
  				300: '#86efac',
  				400: '#4ade80',
  				500: '#22c55e',
  				600: '#16a34a',
  				700: '#15803d',
  				800: '#166534',
  				900: '#14532d'
  			},
  			warning: {
  				50: '#fefce8',
  				100: '#fef9c3',
  				200: '#fef08a',
  				300: '#fde047',
  				400: '#facc15',
  				500: '#eab308',
  				600: '#ca8a04',
  				700: '#a16207',
  				800: '#854d0e',
  				900: '#713f12'
  			},
  			error: {
  				50: '#fef2f2',
  				100: '#fee2e2',
  				200: '#fecaca',
  				300: '#fca5a5',
  				400: '#f87171',
  				500: '#ef4444',
  				600: '#dc2626',
  				700: '#b91c1c',
  				800: '#991b1b',
  				900: '#7f1d1d'
  			}
  		},
  		fontSize: {
  			'2xs': ['0.625rem', { lineHeight: '0.875rem' }],
  			'3xs': ['0.5rem', { lineHeight: '0.75rem' }]
  		},
  		boxShadow: {
        'soft-glow': '0 10px 25px -5px rgba(var(--glow-color), 0.1), 0 4px 6px -2px rgba(var(--glow-color), 0.05)',
  			'glow': '0 0 20px rgba(59, 130, 246, 0.5)',
  			'glow-sm': '0 0 10px rgba(59, 130, 246, 0.3)',
  			'inner-glow': 'inset 0 0 20px rgba(59, 130, 246, 0.15)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'fade-in': {
  				from: { opacity: '0' },
  				to: { opacity: '1' }
  			},
  			'fade-in-up': {
  				from: { 
  					opacity: '0',
  					transform: 'translateY(10px)'
  				},
  				to: { 
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'fade-in-down': {
  				from: { 
  					opacity: '0',
  					transform: 'translateY(-10px)'
  				},
  				to: { 
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'slide-in-from-right': {
  				from: { transform: 'translateX(100%)' },
  				to: { transform: 'translateX(0)' }
  			},
  			'slide-in-from-left': {
  				from: { transform: 'translateX(-100%)' },
  				to: { transform: 'translateX(0)' }
  			},
  			'shimmer': {
  				from: { backgroundPosition: '200% 0' },
  				to: { backgroundPosition: '-200% 0' }
  			},
  			'pulse-slow': {
  				'0%, 100%': { opacity: '1' },
  				'50%': { opacity: '0.5' }
  			},
  			'bounce-subtle': {
  				'0%, 100%': { transform: 'translateY(0)' },
  				'50%': { transform: 'translateY(-10%)' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'fade-in': 'fade-in 0.3s ease-out',
  			'fade-in-up': 'fade-in-up 0.4s ease-out',
  			'fade-in-down': 'fade-in-down 0.4s ease-out',
  			'slide-in-from-right': 'slide-in-from-right 0.3s ease-out',
  			'slide-in-from-left': 'slide-in-from-left 0.3s ease-out',
  			'shimmer': 'shimmer 2s linear infinite',
  			'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
  			'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite'
  		},
  		backgroundImage: {
  			'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
  			'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
  			'shimmer-gradient': 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)'
  		}
  	}
  },
  plugins: [import("tailwindcss-animate")],
}

