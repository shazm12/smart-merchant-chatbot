'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { month: 'Jan', revenue: 45000, orders: 1200 },
  { month: 'Feb', revenue: 52000, orders: 1350 },
  { month: 'Mar', revenue: 48000, orders: 1180 },
  { month: 'Apr', revenue: 61000, orders: 1520 },
  { month: 'May', revenue: 58000, orders: 1480 },
  { month: 'Jun', revenue: 67000, orders: 1650 },
  { month: 'Jul', revenue: 72000, orders: 1800 },
  { month: 'Aug', revenue: 69000, orders: 1720 },
  { month: 'Sep', revenue: 75000, orders: 1890 },
  { month: 'Oct', revenue: 78000, orders: 1950 },
  { month: 'Nov', revenue: 82000, orders: 2100 },
  { month: 'Dec', revenue: 89000, orders: 2250 },
];

export function RevenueChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip 
          formatter={(value, name) => [
            name === 'revenue' ? `RM ${value.toLocaleString()}` : value,
            name === 'revenue' ? 'Revenue' : 'Orders'
          ]}
        />
        <Line 
          type="monotone" 
          dataKey="revenue" 
          stroke="#00b14e" 
          strokeWidth={3}
          dot={{ fill: '#00b14e', strokeWidth: 2, r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}