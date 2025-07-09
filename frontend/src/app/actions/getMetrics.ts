'use server';

import { prisma } from '@/lib/prisma';
import { startOfMonth } from 'date-fns';

export async function getBusinessMetrics() {
  const now = new Date();
  const start = startOfMonth(now);

  const [
    totalOrders,
    totalRevenue,
    avgPrice,
    avgDeliveryTime,
    avgRating,
    refundedCount,
    userCount,
    vegCount,
    offerCount
  ] = await Promise.all([
    prisma.orders.count({ where: { order_time: { gte: start } } }),
    prisma.orders.aggregate({
      _sum: { total_price: true },
      where: { order_time: { gte: start } },
    }),
    prisma.orders.aggregate({
      _avg: { total_price: true },
      where: { order_time: { gte: start } },
    }),
    prisma.orders.aggregate({
      _avg: { delivery_time_min: true },
      where: { order_time: { gte: start } },
    }),
    prisma.orders.aggregate({
      _avg: { user_rating: true },
      where: { order_time: { gte: start } },
    }),
    prisma.orders.count({
      where: { refund_flag: true, order_time: { gte: start } },
    }),
    prisma.orders.count({
      where: { order_time: { gte: start } }
    }),
    prisma.orders.count({
      where: { veg: 'Yes', order_time: { gte: start } },
    }),
    prisma.orders.count({
      where: { offer_applied: true, order_time: { gte: start } },
    }),
  ]);

  return {
    totalOrders,
    totalRevenue: totalRevenue._sum.total_price,
    avgOrderPrice: avgPrice._avg.total_price,
    avgDeliveryTime: avgDeliveryTime._avg.delivery_time_min,
    avgUserRating: avgRating._avg.user_rating,
    refundedOrders: refundedCount,
    uniqueUsers: userCount,
    vegOrderRatio: vegCount / totalOrders,
    offerUsageRatio: offerCount / totalOrders,
  };
}
