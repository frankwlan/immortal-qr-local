import { getServerSession } from next-auth;
import { authOptions } from ......libauthOptions;
import prisma from ......libprisma;

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session.user.id) return res.status(401).end();
  const items = await prisma.qrLink.findMany({
    where { userId session.user.id, deletedAt null },
    orderBy { createdAt desc },
    select { id true, slug true, destination true, createdAt true }
  });
  res.json(items);
}