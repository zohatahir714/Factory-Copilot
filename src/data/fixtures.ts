/**
 * Canonical demo entities — the single source of truth for the seeded factory.
 *
 * Two consumers, and they must agree:
 *   - `demoFactory.ts` builds the transactions on top of these.
 *   - Voice entity binding resolves spoken names against what is on screen.
 *
 * If the mock mind and the seeded ledger disagree, a spoken product name binds
 * to something invisible and the demo falls apart. Hence one file.
 *
 * Dates are relative to `new Date()` at call time so the demo never rots.
 */
import type { Product, Supplier, Customer } from '../types/index';

function iso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

const ORG = 'org_demo';

export const DEMO_ORGANIZATION_ID = ORG;

export const DEMO_SUPPLIERS: Supplier[] = [
  {
    id: 'sup_green_mills', organizationId: ORG, name: 'Green Mills Ltd',
    city: 'Faisalabad', phone: '+92 41 855 1200', email: 'orders@greenmills.pk',
    leadTimeDays: 7, paymentTerms: 'Net 30', createdAt: iso(120)
  },
  {
    id: 'sup_colourchem', organizationId: ORG, name: 'ColorChem Industries',
    city: 'Lahore', phone: '+92 42 3770 4410', email: 'sales@colourchem.pk',
    leadTimeDays: 14, paymentTerms: 'Net 45', createdAt: iso(120)
  },
  {
    id: 'sup_sitara', organizationId: ORG, name: 'Sitara Petrochemicals',
    city: 'Karachi', phone: '+92 21 3455 8890', email: 'supply@sitara.com.pk',
    leadTimeDays: 10, paymentTerms: 'Net 30', createdAt: iso(120)
  },
  {
    id: 'sup_alnoor', organizationId: ORG, name: 'Al-Noor Textiles',
    city: 'Multan', phone: '+92 61 451 7720', email: 'procure@alnoor.pk',
    leadTimeDays: 5, paymentTerms: 'Advance 50%', createdAt: iso(120)
  }
];

export const DEMO_CUSTOMERS: Customer[] = [
  {
    id: 'cus_faisalabad_powerlooms', organizationId: ORG,
    name: 'Faisalabad Powerlooms', city: 'Faisalabad',
    phone: '+92 41 855 9900', email: 'accounts@fbpowerlooms.pk',
    creditLimit: 1500000, outstandingReceivables: 0, createdAt: iso(120)
  },
  {
    id: 'cus_sialkot_weaving', organizationId: ORG,
    name: 'Sialkot Weaving Mills', city: 'Sialkot',
    phone: '+92 52 325 1100', email: 'purchase@sialkotweaving.pk',
    creditLimit: 2000000, outstandingReceivables: 0, createdAt: iso(120)
  },
  {
    // The common Pakistani textile case: a mill that is not on the sales-tax
    // register, so supplies to it carry further tax under STA s.3(1A).
    // NOTE: `Customer` carries no filer flag today — buyer registration is a
    // function argument to `calculateFBRTaxByCategory`, not stored state. The
    // unregistered-buyer path therefore cannot be seeded from the ledger yet;
    // see the FBR payload work, where the category is supplied explicitly.
    id: 'cus_rahim_traders', organizationId: ORG,
    name: 'Rahim Traders', city: 'Lahore',
    phone: '+92 42 3899 2210', email: 'rahimtraders@example.pk',
    creditLimit: 400000, outstandingReceivables: 0, createdAt: iso(120)
  }
];

export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'prd_cotton_yarn_150d', organizationId: ORG, sku: 'CY-150D',
    name: 'Cotton Yarn 150D', category: 'Yarn', unit: 'kg',
    costPrice: 1200, sellingPrice: 1450,
    reorderThreshold: 200, currentStock: 1450,
    createdAt: iso(120), updatedAt: iso(120)
  },
  {
    id: 'prd_polyester_dty', organizationId: ORG, sku: 'PDTY-150D',
    name: 'Polyester DTY 150D', category: 'Yarn', unit: 'kg',
    costPrice: 980, sellingPrice: 1250,
    reorderThreshold: 150, currentStock: 860,
    createdAt: iso(120), updatedAt: iso(120)
  },
  {
    // Deliberately below threshold WITH dispatch history, so the autonomous
    // reorder engine has both the urgency and the demand signal to act on.
    id: 'prd_reactive_dye_blue', organizationId: ORG, sku: 'RD-BLU-100',
    name: 'Reactive Dye Blue', category: 'Dye', unit: 'kg',
    costPrice: 1650, sellingPrice: 2100,
    reorderThreshold: 120, currentStock: 18,
    createdAt: iso(120), updatedAt: iso(120)
  },
  {
    id: 'prd_reactive_dye_black', organizationId: ORG, sku: 'RD-BLK-100',
    name: 'Reactive Dye Black', category: 'Dye', unit: 'kg',
    costPrice: 1580, sellingPrice: 2050,
    reorderThreshold: 100, currentStock: 640,
    createdAt: iso(120), updatedAt: iso(120)
  },
  {
    id: 'prd_softener', organizationId: ORG, sku: 'SFT-001',
    name: 'Softener Liquid', category: 'Chemical', unit: 'liters',
    costPrice: 420, sellingPrice: 640,
    reorderThreshold: 80, currentStock: 310,
    createdAt: iso(120), updatedAt: iso(120)
  },
  {
    id: 'prd_bobbins', organizationId: ORG, sku: 'BOB-STD',
    name: 'Cotton Bobbins', category: 'Packing', unit: 'bags',
    costPrice: 35, sellingPrice: 60,
    reorderThreshold: 500, currentStock: 2400,
    createdAt: iso(120), updatedAt: iso(120)
  }
];

/**
 * The Urdu and Roman-Urdu names a shop floor actually uses, mapped to the
 * catalogue id.
 *
 * WITHOUT THIS THE PRODUCT FAILS IN ITS OWN LEADING LANGUAGE. Product matching
 * compared the question against `Product.name`, which is English. Asked
 * "کتنے یارن اسٹاک ہے" — how much yarn — the copilot matched nothing, fell
 * through to the low-stock sweep, and answered with Reactive Dye Blue's
 * quantity. The user asked about yarn and was told about dye, in the same
 * sentence, with no indication anything had been misread.
 *
 * These are aliases only. Every figure still comes from the product row; the
 * map cannot invent stock, and a name that matches nothing here simply stays
 * unmatched.
 */
export const DEMO_PRODUCT_ALIASES: Record<string, string[]> = {
  prd_cotton_yarn_150d: ['یارن', 'سوتی یارن', 'کاٹن یارن', 'کپھ', 'کپھا', 'یارن سوتی', 'yarn', 'cotton yarn', 'suti', 'kap'],
  prd_polyester_dty: ['پولی ایسٹر', 'پلی ایسٹر', 'پولی ایسٹر یارن', 'polyester', 'dty', 'poly'],
  prd_reactive_dye_blue: ['ری ایکٹو ڈائی', 'ڈائی', 'نیلا ڈائی', 'نیلا', 'بلو ڈائی', 'dye', 'reactive', 'blue dye', 'neela', 'nia'],
  prd_reactive_dye_black: ['کالا ڈائی', 'کالا', 'بلیک ڈائی', 'black dye', 'kala'],
  prd_softener: ['سافٹنر', 'ساف ٹینر', 'نرم کرنے والا', 'softener', 'softner'],
  prd_bobbins: ['بوبن', 'بوبنز', 'ریل', 'bobbin', 'bobbinz', 'booban']
};

export { iso as demoDate };