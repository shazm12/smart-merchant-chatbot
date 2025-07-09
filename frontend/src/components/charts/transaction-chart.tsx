'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { area: 'Kuala Lumpur', transactions: 3200, avgOrder: 24.50 },
  { area: 'Petaling Jaya', transactions: 2800, avgOrder: 28.20 },
  { area: 'Subang Jaya', transactions: 2100, avgOrder: 26.80 },
  { area: 'Shah Alam', transactions: 1900, avgOrder: 23.40 },
  { area: 'Klang', transactions: 1650, avgOrder: 22.10 },
  { area: 'Ampang', transactions: 1400, avgOrder: 25.60 },
  { area: 'Cheras', transactions: 1200, avgOrder: 24.90 },
];

export function TransactionChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="area" angle={-45} textAnchor="end" height={80} />
        <YAxis />
        <Tooltip 
          formatter={(value) => [value.toLocaleString(), 'Transactions']}
        />
        <Bar 
          dataKey="transactions" 
          fill="#00b14e" 
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}