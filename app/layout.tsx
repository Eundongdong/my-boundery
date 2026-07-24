import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "내 바운더리 — AI와 만드는 나만의 생활 지도";
  const description =
    "집과 직장 주변의 장소를 테마별로 모으고, 지도와 노트를 AI와 함께 편집하는 개인 지도 작업실입니다.";

  return {
    metadataBase: new URL(origin),
    title,
    description,
    openGraph: {
      type: "website",
      url: origin,
      title,
      description,
      locale: "ko_KR",
      images: [{ url: `${origin}/og.png`, width: 1731, height: 909, alt: "내 바운더리 — AI와 만드는 나만의 생활 지도" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
