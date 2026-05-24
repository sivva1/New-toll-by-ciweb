import './globals.css'

export const metadata = {
  title: 'CIWEB Link Shortener',
  description: 'Free URL shortener with analytics. No sign-up needed.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
