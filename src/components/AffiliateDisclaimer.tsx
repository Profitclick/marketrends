import { AlertCircle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";

interface AffiliateDisclaimerProps {
  partnerName?: string;
  riskWarning?: string | null;
}

export const AffiliateDisclaimer = ({ partnerName, riskWarning }: AffiliateDisclaimerProps) => {
  return (
    <div className="space-y-4 my-8">
      {/* Affiliate Disclaimer */}
      <Alert className="border-amber-500/50 bg-amber-500/10">
        <ExternalLink className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-sm">
          <strong>Partnerinnhold:</strong> Denne artikkelen inneholder affiliate-lenker
          {partnerName && ` til ${partnerName}`}. Marketrends.no kan motta provisjon dersom du 
          foretar et kjøp via disse lenkene, uten ekstra kostnad for deg. Dette påvirker ikke 
          vår redaksjonelle vurdering.
        </AlertDescription>
      </Alert>

      {/* Risk Warning */}
      {riskWarning && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-sm">
            <strong>Risikovarsel:</strong> {riskWarning}
          </AlertDescription>
        </Alert>
      )}

      {/* General Investment Warning */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs text-muted-foreground">
          <strong>Generelt investeringsvarsel:</strong> Investering innebærer risiko for tap. 
          Historisk avkastning er ingen garanti for fremtidig avkastning. Denne artikkelen er 
          ikke finansiell rådgivning. Les alltid vilkår og betingelser nøye, og vurder din 
          egen risikotoleranse før du investerer.
        </AlertDescription>
      </Alert>
    </div>
  );
};
