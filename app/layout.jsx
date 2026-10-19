import './globals.css';

export const metadata = {
  title: 'Roots — Cultural & Lifestyle Clinical Intelligence',
  description: 'Qloo-powered clinical lifestyle intelligence for doctors.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
