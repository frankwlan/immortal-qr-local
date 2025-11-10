import prisma from "../../../../lib/prisma";

export default async function handler(req, res) {
  const { slug } = req.query;

  const link = await prisma.qrLink.findUnique({ where: { slug } });
  if (!link || link.deletedAt) {
    return res.status(404).send("Not found");
  }

  res.setHeader("Cache-Control", "no-store");
  res.writeHead(302, { Location: link.destination });
  res.end();
}