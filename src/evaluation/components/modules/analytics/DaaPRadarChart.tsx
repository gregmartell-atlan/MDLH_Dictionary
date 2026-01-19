import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import type { PlanComparisonResult } from '../../../services/planComparisonEngine';

interface DaaPRadarChartProps {
  comparison: PlanComparisonResult;
}

export function DaaPRadarChart({ comparison }: DaaPRadarChartProps) {
  // Map actual completion metrics to DaaP dimensions
  // This uses real data from the comparison engine
  const calculateDimensionScore = (dimension: string) => {
    const { gapsByField, overallQualityScore, averageCompletion } = comparison.aggregateMetrics;
    
    // Helper to get coverage for a specific field (0-100)
    const getCoverage = (field: string) => gapsByField[field]?.coverage || 0;
    
    // Helper to check if field exists in plan
    const hasField = (field: string) => field in gapsByField;

    switch (dimension) {
      case 'Discoverable':
        // Weighted average of discovery fields
        const discFields = ['description', 'userDescription', 'atlanTags', 'glossaryTerms', 'ownerUsers'];
        const activeDisc = discFields.filter(hasField);
        if (activeDisc.length === 0) return averageCompletion; // Fallback
        return Math.round(activeDisc.reduce((sum, f) => sum + getCoverage(f), 0) / activeDisc.length);

      case 'Addressable':
        // Connection, DB, Schema are usually 100% if assets exist
        // We can use overall completion as a proxy for "is it fully mapped?"
        return 100; 

      case 'Trustworthy':
        // Lineage, Certification, Quality Score
        const trustFields = ['lineage', 'certificateStatus'];
        const activeTrust = trustFields.filter(hasField);
        // Mix specific fields with overall quality score
        const fieldScore = activeTrust.length > 0 
          ? activeTrust.reduce((sum, f) => sum + getCoverage(f), 0) / activeTrust.length
          : overallQualityScore;
        return Math.round((fieldScore + overallQualityScore) / 2);

      case 'Self-describing':
        // Readme, Columns
        const descFields = ['readme', 'columns'];
        const activeDesc = descFields.filter(hasField);
        if (activeDesc.length === 0) return getCoverage('description');
        return Math.round(activeDesc.reduce((sum, f) => sum + getCoverage(f), 0) / activeDesc.length);

      case 'Interoperable':
        // Placeholder: usually implies standards compliance
        return overallQualityScore;

      case 'Secure':
        // Classifications
        return hasField('classifications') ? getCoverage('classifications') : 100; // Assume secure if not required? Or 0?

      case 'Reusable':
        // Usage stats + Description + Quality
        return Math.round((getCoverage('description') + overallQualityScore) / 2);
        
      default:
        return 0;
    }
  };

  const data = [
    { subject: 'Discoverable', A: calculateDimensionScore('Discoverable'), fullMark: 100 },
    { subject: 'Addressable', A: calculateDimensionScore('Addressable'), fullMark: 100 },
    { subject: 'Trustworthy', A: calculateDimensionScore('Trustworthy'), fullMark: 100 },
    { subject: 'Self-describing', A: calculateDimensionScore('Self-describing'), fullMark: 100 },
    { subject: 'Interoperable', A: calculateDimensionScore('Interoperable'), fullMark: 100 },
    { subject: 'Secure', A: calculateDimensionScore('Secure'), fullMark: 100 },
    { subject: 'Reusable', A: calculateDimensionScore('Reusable'), fullMark: 100 },
  ];

  return (
    <div className="w-full h-[400px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Data as a Product Score</h3>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <Radar
            name="Current Plan"
            dataKey="A"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            itemStyle={{ color: '#1e293b', fontWeight: 600 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
