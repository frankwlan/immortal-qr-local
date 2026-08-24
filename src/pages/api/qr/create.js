import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";
import isURL from "validator/lib/isURL";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
 if (req.method !== "POST") return res.status(405).end();

 const session = await getServerSession(req, res, authOptions);
 if (!session?.user?.id) return res.status(401).end();

 const destination = String(req.body?.destination ?? "").trim();
 if (!isURL(destination, { protocols: ["http", "https"], require_protocol: true })) {
   return res.status(400).json({ error: "Invalid URL" });
 }

 for (let attempt = 0; attempt < 5; attempt += 1) {
   const slug = randomUUID().slice(0, 8);

   try {
     const record = await prisma.qrLink.create({
       data: {
         userId: session.user.id,
         destination,
         slug,
       },
       select: { id: true, slug: true, destination: true },
     });

     return res.status(200).json(record);
   } catch (error) {
     const isUniqueSlugError = error?.code === "P2002" && Array.isArray(error?.meta?.target) && error.meta.target.includes("slug");
     if (!isUniqueSlugError) throw error;
   }
 }

 return res.status(500).json({ error: "Could not generate a unique link" });
}