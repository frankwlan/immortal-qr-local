import prisma from "./prisma";

// Permanently removes a user and everything under them. QR codes and scan
// events have no ON DELETE CASCADE, so they go first, children before
// parents, inside ONE transaction: either everything is erased or nothing is.
// (Linked Account/Session rows cascade in the database.)
export async function eraseUser(userId) {
  await prisma.$transaction([
    prisma.scanEvent.deleteMany({ where: { qrLink: { userId } } }),
    prisma.qrLink.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
