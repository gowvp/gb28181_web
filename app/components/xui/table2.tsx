// import * as React from "react";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "~/components/ui/table";
// import { motion, AnimatePresence } from "framer-motion";
// import PaginationBox from "./pagination";
// import { useRef, useEffect, useState } from "react";

// interface Column<T> {
//   key: string;
//   title: React.ReactNode;
//   render?: (value: any, record: T) => React.ReactNode;
// }

// interface XTable2Props<T> {
//   columns: Column<T>[];
//   dataSource?: T[];
//   rowKey: string;
//   className?: string;
//   loading?: boolean;
//   pagination?: {
//     page: number;
//     size: number;
//     total: number;
//     setPagination: (page: number, size: number) => void;
//   };
// }

// type OperationType = "add" | "delete" | "none";

// export function XTable2<T extends object>({
//   columns,
//   dataSource = [],
//   rowKey,
//   className,
//   loading,
//   pagination,
// }: XTable2Props<T>) {
//   const prevDataRef = useRef<T[]>([]);
//   const [operation, setOperation] = useState<{
//     type: OperationType;
//     id?: string;
//     index?: number;
//   }>({ type: "none" });

//   useEffect(() => {
//     const prevData = prevDataRef.current;
//     // 如果是首次加载，不执行动画
//     if (prevData.length === 0) {
//       prevDataRef.current = dataSource;
//       return;
//     }

//     // 避免不必要的状态更新
//     if (prevData === dataSource) {
//       return;
//     }

//     let newOperation = { type: "none" as OperationType };

//     if (dataSource.length === prevData.length + 1) {
//       // 添加操作
//       const newRecord = dataSource.find(
//         (curr: any) =>
//           !prevData.some((prev: any) => prev[rowKey] === curr[rowKey])
//       );
//       if (newRecord) {
//         const index = dataSource.findIndex(
//           (item: any) => item[rowKey] === (newRecord as any)[rowKey]
//         );
//         newOperation = {
//           type: "add",
//           id: (newRecord as any)[rowKey],
//           index,
//         };
//       }
//     } else if (dataSource.length < prevData.length) {
//       // 删除操作
//       const deletedRecord = prevData.find(
//         (prev: any) =>
//           !dataSource.some((curr: any) => curr[rowKey] === prev[rowKey])
//       );
//       if (deletedRecord) {
//         const index = prevData.findIndex(
//           (item: any) => item[rowKey] === (deletedRecord as any)[rowKey]
//         );
//         newOperation = {
//           type: "delete",
//           id: (deletedRecord as any)[rowKey],
//           index,
//         };
//       }
//     }

//     setOperation(newOperation);
//     prevDataRef.current = dataSource;
//   }, [dataSource, rowKey]);

//   const renderCell = (record: T, column: Column<T>) => {
//     const value = (record as any)[column.key];
//     return column.render ? column.render(value, record) : value;
//   };

//   return (
//     <div className={className}>
//       <div className="overflow-hidden rounded-md border">
//         <Table>
//           <TableHeader>
//             <TableRow className="hover:bg-transparent">
//               {columns.map((column) => (
//                 <TableHead key={column.key} className="font-medium">
//                   {column.title}
//                 </TableHead>
//               ))}
//             </TableRow>
//           </TableHeader>
//           <TableBody>
//             <AnimatePresence initial={false} mode="popLayout">
//               {dataSource.map((record: T, index) => {
//                 const recordId = (record as any)[rowKey];
//                 const isNewRecord =
//                   operation.type === "add" && recordId === operation.id;
//                 const shouldShift =
//                   operation.type === "add" && index >= (operation.index ?? 0);

//                 return (
//                   <motion.tr
//                     key={recordId}
//                     className="hover:bg-muted/50"
//                     initial={
//                       isNewRecord
//                         ? { opacity: 0, x: 20 }
//                         : shouldShift
//                         ? { y: -40 }
//                         : { opacity: 1 }
//                     }
//                     animate={
//                       isNewRecord
//                         ? { opacity: 1, x: 0 }
//                         : shouldShift
//                         ? { y: 0 }
//                         : { opacity: 1 }
//                     }
//                     exit={
//                       operation.type === "delete" && recordId === operation.id
//                         ? { opacity: 0, y: -20 }
//                         : undefined
//                     }
//                     transition={{
//                       duration: 0.2,
//                       ease: "easeOut",
//                       delay: isNewRecord ? 0.15 : 0,
//                     }}
//                   >
//                     {columns.map((column) => (
//                       <TableCell key={column.key} className="font-normal">
//                         {renderCell(record, column)}
//                       </TableCell>
//                     ))}
//                   </motion.tr>
//                 );
//               })}
//             </AnimatePresence>
//           </TableBody>
//         </Table>
//       </div>

//       <div>
//         <PaginationBox
//           page={pagination?.page ?? 1}
//           size={pagination?.size ?? 10}
//           total={pagination?.total ?? 0}
//           setPagination={pagination?.setPagination ?? (() => {})}
//         />
//       </div>
//     </div>
//   );
// }
