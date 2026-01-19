import type { RequirementsMatrix } from '../types/requirements';
import type { FieldCoverageResult } from '../hooks/useFieldCoverage';

/**
 * Calculate Data as a Product scores based on matrix requirements
 * (Reused logic from DaaPRadarChart for consistency)
 */
function calculateDaaPScores(matrix: RequirementsMatrix) {
  const calculateScore = (dimension: string) => {
    const totalAssets = matrix.assetTypeRequirements.length || 1;
    let score = 0;

    matrix.assetTypeRequirements.forEach(req => {
      const fields = req.requirements.map(r => r.field);
      
      switch (dimension) {
        case 'Discoverable':
          if (fields.includes('description')) score += 0.25;
          if (fields.includes('ownerUsers') || fields.includes('ownerGroups')) score += 0.25;
          if (fields.includes('tags')) score += 0.25;
          if (fields.includes('assignedTerms')) score += 0.25;
          break;
        case 'Addressable':
          score += 1;
          break;
        case 'Trustworthy':
          if (fields.includes('lineage')) score += 0.5;
          if (fields.includes('certificateStatus')) score += 0.5;
          break;
        case 'Self-describing':
          if (fields.includes('readme')) score += 0.5;
          if (fields.includes('columns')) score += 0.5;
          break;
        case 'Interoperable':
          score += 0.6; 
          break;
        case 'Secure':
          if (fields.includes('classifications')) score += 1;
          break;
        case 'Reusable':
          score += 0.5;
          break;
      }
    });

    return Math.min(100, Math.round((score / totalAssets) * 100));
  };

  return {
    Discoverable: calculateScore('Discoverable'),
    Addressable: calculateScore('Addressable'),
    Trustworthy: calculateScore('Trustworthy'),
    'Self-describing': calculateScore('Self-describing'),
    Interoperable: calculateScore('Interoperable'),
    Secure: calculateScore('Secure'),
    Reusable: calculateScore('Reusable'),
  };
}

/**
 * Generate and download a CSV report of the analytics
 */
export function exportAnalyticsReport(matrix: RequirementsMatrix, coverage: FieldCoverageResult[]) {
  const daapScores = calculateDaaPScores(matrix);
  const timestamp = new Date().toISOString().split('T')[0];
  
  // Section 1: DaaP Scores
  let csvContent = "DATA AS A PRODUCT SCORES\n";
  csvContent += "Dimension,Score\n";
  Object.entries(daapScores).forEach(([dim, score]) => {
    csvContent += `${dim},${score}\n`;
  });

  // Section 2: Coverage Data
  csvContent += "\nMETADATA COVERAGE DETAILS\n";
  csvContent += "Field,Asset Type,Populated,Total,Percentage\n";
  
  coverage.forEach(fieldResult => {
    Object.entries(fieldResult.byAssetType).forEach(([assetType, stats]) => {
      if (stats.total > 0) {
        const percentage = Math.round((stats.populated / stats.total) * 100);
        csvContent += `${fieldResult.field},${assetType},${stats.populated},${stats.total},${percentage}%\n`;
      }
    });
  });

  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `governance_analytics_report_${timestamp}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
