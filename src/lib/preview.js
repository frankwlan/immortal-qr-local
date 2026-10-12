import prisma from "./prisma";
import { SLUG_PATTERN } from "./slug";
import { toSafeLocation } from "./url";
import { redirectIpLimiter } from "./linkLimits";

// Data for the public /preview/<code> page, which shows where a code leads
// WITHOUT redirecting — so people can check a link before trusting it, and
// can report it. Kept out of the page file so it can be tested.
//
// Returns { status: "ok" | "not_found" | "limited", link? }.
export async function getPreview(slug, ip) {
  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) return { status: "not_found" };

  const { allowed } = await redirectIpLimiter.check(ip);
  if (!allowed) return { status: "limited" };

  const link = await prisma.qrLink.findUnique({
    where: { slug },
    select: { slug: true, destination: true, deletedAt: true, disabledAt: true },
  });
  if (!link || link.deletedAt) return { status: "not_found" };

  const destination = toSafeLocation(link.destination);
  if (!destination) return { status: "not_found" };

  return {
    status: "ok",
    link: {
      slug: link.slug,
      destination,
      host: new URL(destination).host,
      disabled: Boolean(link.disabledAt),
    },
  };
}
