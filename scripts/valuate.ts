import { valueAllListings } from '@/lib/services/valuator';
import { estimateAllCosts } from '@/lib/services/cost-estimator';
await valueAllListings();
await estimateAllCosts();
console.log('Done');
