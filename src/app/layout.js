import './globals.css'

export const metadata = { title: 'Portal do Paciente' }

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="container">
          <div className="header">
            <div className="brand">
            </div>
          </div>
          {children}
        </div>
      </body>
    </html>
  )
}
