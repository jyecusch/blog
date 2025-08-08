import type { APIRoute } from "astro";
import { generateOgImageForSite } from "@/utils/generateOgImages";

export const GET: APIRoute = async () => {
  const buffer = await generateOgImageForSite();
  return new Response(buffer as unknown as BodyInit, {
    headers: { "Content-Type": "image/png" },
  });
};
