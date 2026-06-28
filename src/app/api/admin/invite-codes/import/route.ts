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
  // 管理员鉴权
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "无管理员权限" }, { status: 401 });

  // 解析请求体
  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "请求JSON格式错误" }, { status: 400 });
  }

  const { items }: { items: ImportItem[] } = payload;
  // 校验数组非空
  if (!Array.isArray(items) || items.length === 0)
    return NextResponse.json({ error: "导入数据不能为空" }, { status: 400 });

  // 预处理每条导入数据
  const creatorId = session.userId;
  const createData = items.map((item) => {
    const code = item.code?.trim();
    if (!code) throw new Error("存在空邀请码");
    return {
      code,
      sourceSite: item.sourceSite?.trim() || null,
      note: item.note?.trim() || null,
      expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
      createdById: creatorId,
    };
  });

  try {
    await prisma.inviteCode.createMany({ data: createData, skipDuplicates: false });
  } catch (err: any) {
    // 唯一索引冲突=重复code
    if (err.code === "P2002") {
      return NextResponse.json({ error: "存在重复邀请码，导入终止" }, { status: 400 });
    }
    return NextResponse.json({ error: "导入失败：" + (err.message || "数据库异常") }, { status: 500 });
  }

  return NextResponse.json({ success: true, importCount: items.length });
}
