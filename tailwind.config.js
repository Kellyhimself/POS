export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      screens: {
        'xs': '380px',    // For the smallest supported devices
        'sm': '409px',    // For smaller phones
        'md': '480px',    // General mobile breakpoint
        'tablet': '640px',
        'lg': '768px',
        'xl': '1024px',
        '2xl': '1280px',
      },
    },
  },
  plugins: [],
}; 