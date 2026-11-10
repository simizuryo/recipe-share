import type { Metadata } from "next";

import { Header } from "@/components/header/header";

import "./globals.css";

export const metadata: Metadata = {
  title: "recipe-share",
  description: "料理のレシピを投稿・検索・保存できるレシピ共有アプリ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
