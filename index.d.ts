/**
 * electron-db - Modern flat file database solution for Electron and Node.js
 * TypeScript definitions for version 1.0.0
 */

export interface ElectronDBError extends Error {
  code?: string;
}

export type CallbackFunction<T = any> = (error: ElectronDBError | null, result?: T) => void;

export interface TableRow {
  [key: string]: any;
  id?: number;
}

export interface WhereClause {
  [key: string]: any;
}

export interface UpdateClause {
  [key: string]: any;
}

// Legacy callback-based API
export function createTable(tableName: string, callback: CallbackFunction<string>): void;
export function createTable(tableName: string, location: string, callback: CallbackFunction<string>): void;

export function insertTableContent(tableName: string, data: TableRow, callback: CallbackFunction<string>): void;
export function insertTableContent(tableName: string, location: string, data: TableRow, callback: CallbackFunction<string>): void;

export function insertTableContents(tableName: string, data: TableRow[], callback: CallbackFunction<string>): void;
export function insertTableContents(tableName: string, location: string, data: TableRow[], callback: CallbackFunction<string>): void;

export function getAll(tableName: string, callback: CallbackFunction<TableRow[]>): void;
export function getAll(tableName: string, location: string, callback: CallbackFunction<TableRow[]>): void;

export function getRows(tableName: string, where: WhereClause, callback: CallbackFunction<TableRow[]>): void;
export function getRows(tableName: string, location: string, where: WhereClause, callback: CallbackFunction<TableRow[]>): void;

export function updateRow(tableName: string, where: WhereClause, set: UpdateClause, callback: CallbackFunction<string>): void;
export function updateRow(tableName: string, location: string, where: WhereClause, set: UpdateClause, callback: CallbackFunction<string>): void;

export function search(tableName: string, field: string, keyword: string, callback: CallbackFunction<TableRow[]>): void;
export function search(tableName: string, location: string, field: string, keyword: string, callback: CallbackFunction<TableRow[]>): void;

export function deleteRow(tableName: string, where: WhereClause, callback: CallbackFunction<string>): void;
export function deleteRow(tableName: string, location: string, where: WhereClause, callback: CallbackFunction<string>): void;

export function valid(tableName: string, callback: CallbackFunction<boolean>): void;
export function valid(tableName: string, location: string, callback: CallbackFunction<boolean>): void;

export function clearTable(tableName: string, callback: CallbackFunction<string>): void;
export function clearTable(tableName: string, location: string, callback: CallbackFunction<string>): void;

export function getField(tableName: string, field: string, callback: CallbackFunction<any[]>): void;
export function getField(tableName: string, location: string, field: string, callback: CallbackFunction<any[]>): void;

export function count(tableName: string, callback: CallbackFunction<number>): void;
export function count(tableName: string, location: string, callback: CallbackFunction<number>): void;

export function tableExists(tableName: string, callback: CallbackFunction<boolean>): void;
export function tableExists(tableName: string, location: string, callback: CallbackFunction<boolean>): void;

// Modern Promise-based API
export function createTableAsync(tableName: string): Promise<string>;
export function createTableAsync(tableName: string, location: string): Promise<string>;

export function insertTableContentAsync(tableName: string, data: TableRow): Promise<string>;
export function insertTableContentAsync(tableName: string, location: string, data: TableRow): Promise<string>;

export function insertTableContentsAsync(tableName: string, data: TableRow[]): Promise<string>;
export function insertTableContentsAsync(tableName: string, location: string, data: TableRow[]): Promise<string>;

export function getAllAsync(tableName: string): Promise<TableRow[]>;
export function getAllAsync(tableName: string, location: string): Promise<TableRow[]>;

export function getRowsAsync(tableName: string, where: WhereClause): Promise<TableRow[]>;
export function getRowsAsync(tableName: string, location: string, where: WhereClause): Promise<TableRow[]>;

export function updateRowAsync(tableName: string, where: WhereClause, set: UpdateClause): Promise<string>;
export function updateRowAsync(tableName: string, location: string, where: WhereClause, set: UpdateClause): Promise<string>;

export function searchAsync(tableName: string, field: string, keyword: string): Promise<TableRow[]>;
export function searchAsync(tableName: string, location: string, field: string, keyword: string): Promise<TableRow[]>;

export function deleteRowAsync(tableName: string, where: WhereClause): Promise<string>;
export function deleteRowAsync(tableName: string, location: string, where: WhereClause): Promise<string>;

export function validAsync(tableName: string): Promise<boolean>;
export function validAsync(tableName: string, location: string): Promise<boolean>;

export function clearTableAsync(tableName: string): Promise<string>;
export function clearTableAsync(tableName: string, location: string): Promise<string>;

export function getFieldAsync(tableName: string, field: string): Promise<any[]>;
export function getFieldAsync(tableName: string, location: string, field: string): Promise<any[]>;

export function countAsync(tableName: string): Promise<number>;
export function countAsync(tableName: string, location: string): Promise<number>;

export function tableExistsAsync(tableName: string): Promise<boolean>;
export function tableExistsAsync(tableName: string, location: string): Promise<boolean>;

// Utility functions
export function promisify<T extends (...args: any[]) => void>(fn: T): (...args: Parameters<T>) => Promise<any>;

export interface ElectronDBInternals {
  userData: string;
}

export function _getInternals(): ElectronDBInternals;

// Default export for CommonJS compatibility
declare const electronDB: {
  // Legacy callback-based API
  createTable: typeof createTable;
  insertTableContent: typeof insertTableContent;
  insertTableContents: typeof insertTableContents;
  getAll: typeof getAll;
  getRows: typeof getRows;
  updateRow: typeof updateRow;
  search: typeof search;
  deleteRow: typeof deleteRow;
  valid: typeof valid;
  clearTable: typeof clearTable;
  getField: typeof getField;
  count: typeof count;
  tableExists: typeof tableExists;
  
  // Modern Promise-based API
  createTableAsync: typeof createTableAsync;
  insertTableContentAsync: typeof insertTableContentAsync;
  insertTableContentsAsync: typeof insertTableContentsAsync;
  getAllAsync: typeof getAllAsync;
  getRowsAsync: typeof getRowsAsync;
  updateRowAsync: typeof updateRowAsync;
  searchAsync: typeof searchAsync;
  deleteRowAsync: typeof deleteRowAsync;
  validAsync: typeof validAsync;
  clearTableAsync: typeof clearTableAsync;
  getFieldAsync: typeof getFieldAsync;
  countAsync: typeof countAsync;
  tableExistsAsync: typeof tableExistsAsync;
  
  // Utility functions
  promisify: typeof promisify;
  _getInternals: typeof _getInternals;
};

export = electronDB;