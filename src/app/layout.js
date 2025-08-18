// app/layout.js
import './globals.css'

export const metadata = { title: 'Portal do Paciente' }

// 👇 Meta viewport para Safari/iOS e telas pequenas
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ minHeight: '100svh' }}>
        <div className="container">
          <div className="header">
            <div className="brand" />
          </div>
          {children}
        </div>
      </body>
    </html>
  )
}
