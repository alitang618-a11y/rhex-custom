import { prisma } from "@/db/client"

export type InviteCodeUsageStatus = "all" | "used" | "unused"

// 新增批量创建行类型，带上sourceSite、expiresAt
export type InviteCodeBatchCreateRow = {
  code: string;
  createdById?: number | null;
  note?: string | null;
  sourceSite?: string | null;
  expiresAt?: Date | null;
}

function buildInviteCodeCreatorWhere(userId: number, status: InviteCodeUsageStatus = "all") {
  return {
    createdById: userId,
    ...(status === "used"
      ? { usedById: { not: null } }
      : status === "unused"
        ? { usedById: null }
        : {}),
  }
}

export function findInviteCodeByCode(code: string) {
  return prisma.inviteCode.findUnique({ where: { code } })
}

// 修改：支持传入带sourceSite/expiresAt的批量行
export function createInviteCodesBatch(data: InviteCodeBatchCreateRow[]) {
  return prisma.inviteCode.createMany({ data })
}

export function findInviteCodesByCodes(codes: string[]) {
  return prisma.inviteCode.findMany({
    where: {
      code: {
        in: codes,
      },
    },
    orderBy: { createdAt: "desc" },
    // 读取新增字段
    select: {
      id: true,
      code: true,
      note: true,
      sourceSite: true,
      expiresAt: true,
      createdAt: true,
      usedAt: true,
      createdById: true,
      usedById: true,
      createdBy: { select: { username: true, nickname: true } },
      usedBy: { select: { username: true, nickname: true } },
    }
  })
}

// 修改：支持sourceSite模糊搜索，查询带出sourceSite、expiresAt
export function findInviteCodeList(limit: number, sourceSearch?: string) {
  const where = sourceSearch
    ? { sourceSite: { contains: sourceSearch, mode: "insensitive" } }
    : {}

  return prisma.inviteCode.findMany({
    where,
    orderBy: [{ usedAt: "asc" }, { createdAt: "desc" }],
    take: Math.max(1, Math.min(limit, 200)),
    include: {
      createdBy: { select: { username: true, nickname: true } },
      usedBy: { select: { username: true, nickname: true } },
    },
    select: {
      id: true,
      code: true,
      note: true,
      sourceSite: true,
      expiresAt: true,
      createdAt: true,
      usedAt: true,
      createdById: true,
      usedById: true,
    }
  })
}

// 【新增】管理员分页查询函数，用于后台列表分页+来源站点搜索
export async function findInviteCodeListPaginated(page: number, pageSize: number, sourceSearch?: string) {
  const skip = (page - 1) * pageSize
  const where = sourceSearch
    ? { sourceSite: { contains: sourceSearch, mode: "insensitive" } }
    : {}

  const [total, rows] = await Promise.all([
    prisma.inviteCode.count({ where }),
    prisma.inviteCode.findMany({
      skip,
      take: pageSize,
      where,
      orderBy: [{ usedAt: "asc" }, { createdAt: "desc" }],
      include: {
        createdBy: { select: { username: true, nickname: true } },
        usedBy: { select: { username: true, nickname: true } },
      },
      select: {
        id: true,
        code: true,
        note: true,
        sourceSite: true,
        expiresAt: true,
        createdAt: true,
        usedAt: true,
        createdById: true,
        usedById: true,
      }
    })
  ])

  return { total, rows }
}

export function deleteInviteCodeById(id: string) {
  return prisma.inviteCode.deleteMany({
    where: { id },
  })
}

export function deleteInviteCodesByScope(scope: "all" | "used" | "unused") {
  return prisma.inviteCode.deleteMany({
    where: scope === "all"
      ? {}
      : {
          usedAt: scope === "used" ? { not: null } : null,
        },
  })
}

export function countInviteCodesByCreator(userId: number, status: InviteCodeUsageStatus = "all") {
  return prisma.inviteCode.count({
    where: buildInviteCodeCreatorWhere(userId, status),
  })
}

// 修改：用户自己的邀请码列表带出新增字段
export function findInviteCodesByCreator(userId: number, options: { page: number; pageSize: number; status?: InviteCodeUsageStatus }) {
  const page = Math.max(1, Math.trunc(options.page))
  const pageSize = Math.max(1, Math.min(Math.trunc(options.pageSize), 1000))

  return prisma.inviteCode.findMany({
    where: buildInviteCodeCreatorWhere(userId, options.status ?? "all"),
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      code: true,
      sourceSite: true,
      expiresAt: true,
      createdAt: true,
      usedAt: true,
      usedBy: {
        select: {
          username: true,
        },
      },
    },
  })
}

export function findInviteCodeForUse(code: string) {
  return prisma.inviteCode.findUnique({
    where: { code },
    select: { id: true, code: true, createdById: true, usedById: true },
  })
}

export function findUserInviteResolverByUsername(username: string) {
  return prisma.user.findUnique({ where: { username }, select: { id: true, username: true } })
}

export function findUserInviteResolverById(userId: number) {
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true } })
}

export function findInvitePurchaseUser(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      points: true,
      username: true,
      vipLevel: true,
      vipExpiresAt: true,
    },
  })
}
