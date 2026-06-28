import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

type ImportItem = {
  code: string;
  sourceSite?: string;
  note?: string;
  expiresAt?: string;
};

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "无管理员权限" }, { status: 401 });

  const { items }: { items: ImportItem[] } = await req.json();
  if (!Array.isArray(items) || items.length === 0)
    return NextResponse.json({ error: "导入数据不能为空" }, { status: 400 });

  const creatorId = session.userId;
  const createData = items.map((item) => ({
    code: item.code.trim(),
    sourceSite: item.sourceSite?.trim() || null,
    note: item.note?.trim() || null,
    expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
    createdById: creatorId,
  }));

  try {
    await prisma.inviteCode.createMany({ data: createData, skipDuplicates: false });
  } catch (err: any) {
    return NextResponse.json({ error: "存在重复邀请码，导入终止" }, { status: 400 });
  }

  return NextResponse.json({ success: true, importCount: items.length });
}
