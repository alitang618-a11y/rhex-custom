import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInviteCodes } from "@/lib/invite-codes";
import { getAdminSession } from "@/lib/auth";

// 分页查询邀请码，支持sourceSite模糊筛选
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "无管理员权限" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");
  const sourceSite = searchParams.get("sourceSite") || undefined;

  const where: Record<string, any> = {};
  if (sourceSite) where.sourceSite = { contains: sourceSite, mode: "insensitive" };

  const [list, total] = await Promise.all([
    prisma.inviteCode.findMany({
      where,
      include: {
        createdBy: { select: { id, username, nickname } },
        usedBy: { select: { id, username, nickname } }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inviteCode.count({ where }),
  ]);

  return NextResponse.json({
    list,
    total,
    page,
    pageSize,
    totalPage: Math.ceil(total / pageSize),
  });
}

// 批量生成邀请码接口（携带sourceSite、expiresAt、note参数）
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "无管理员权限" }, { status: 401 });

  const { count, expiresAt, sourceSite, note } = await req.json();
  if (!count || count < 1) return NextResponse.json({ error: "生成数量必须大于0" }, { status: 400 });

  const codes = await generateInviteCodes({
    count,
    creatorId: session.userId,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    sourceSite: sourceSite || null,
    note: note || null,
  });

  return NextResponse.json({ success: true, codes });
}

// 删除单条邀请码
export async function DELETE(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "无管理员权限" }, { status: 401 });

  const { id } = await req.json();
  await prisma.inviteCode.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
