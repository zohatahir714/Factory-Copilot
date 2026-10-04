import { UserRole, RolePermissions } from '../types';

export const getRolePermissions = (role: UserRole): RolePermissions => {
  switch (role) {
    case 'Super Admin':
      return {
        canManageUsers: true,
        canDeleteRecords: true,
        canEditSettings: true,
        canManageInventory: true,
        canManageProcurement: true,
        canManageSalesAndTax: true,
        canManageCashbook: true,
        canPrintDocuments: true
      };
    case 'Admin':
      return {
        canManageUsers: false,
        canDeleteRecords: false,
        canEditSettings: false,
        canManageInventory: true,
        canManageProcurement: true,
        canManageSalesAndTax: true,
        canManageCashbook: true,
        canPrintDocuments: true
      };
    case 'Head Accountant':
      return {
        canManageUsers: false,
        canDeleteRecords: false,
        canEditSettings: false,
        canManageInventory: false,
        canManageProcurement: false,
        canManageSalesAndTax: true,
        canManageCashbook: true,
        canPrintDocuments: true
      };
    case 'Factory Supervisor':
      return {
        canManageUsers: false,
        canDeleteRecords: false,
        canEditSettings: false,
        canManageInventory: true,
        canManageProcurement: true,
        canManageSalesAndTax: false,
        canManageCashbook: false,
        canPrintDocuments: true
      };
    case 'Tax Auditor':
    default:
      return {
        canManageUsers: false,
        canDeleteRecords: false,
        canEditSettings: false,
        canManageInventory: false,
        canManageProcurement: false,
        canManageSalesAndTax: false,
        canManageCashbook: false,
        canPrintDocuments: true
      };
  }
};
