import { useState, useEffect } from "react";
import {
  Play,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  AlertCircle,
  Award,
  Target,
  ShieldCheck,
} from "lucide-react";
import { EvalSummary, fetchEvalSummary, runEval } from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function EvalTab() {
  const [evalData, setEvalData] = useState<EvalSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLatest = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEvalSummary();
      setEvalData(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load evaluation history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLatest();
  }, []);

  const handleRunEval = async () => {
    setRunning(true);
    setError(null);
    try {
      const summary = await runEval();
      setEvalData(summary);
    } catch (err: any) {
      setError(err?.message || "Failed to execute evaluation suite");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Run Action */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Golden Set Benchmark Suite
          </h2>
          <p className="text-xs text-slate-500">
            Evaluates 10 fixed questions (8 across documents in English/German + 2 out-of-scope abstentions)
          </p>
        </div>
        <Button onClick={handleRunEval} disabled={running}>
          {running ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running 10 Questions...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4 fill-current" />
              Run 10-Question Eval
            </>
          )}
        </Button>
      </div>

      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* KPI Summary Cards */}
      {evalData && evalData.total_questions > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Total Benchmark Score
              </CardTitle>
              <Award className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {evalData.passed_count} / {evalData.total_questions}
              </div>
              <p className="text-xs text-slate-500 pt-1">
                {(evalData.pass_rate * 100).toFixed(0)}% overall accuracy
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Retrieval Hit Rate
              </CardTitle>
              <Target className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {(evalData.retrieval_hit_rate * 100).toFixed(0)}%
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Ground-truth doc present in top-5 chunks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Abstention Accuracy
              </CardTitle>
              <ShieldCheck className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {(evalData.abstention_accuracy * 100).toFixed(0)}%
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Correctly abstains on unanswerable questions
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Test Cases Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Detailed Test Results
            {evalData?.run_at && (
              <span className="text-xs font-normal text-slate-400">
                (Last run: {new Date(evalData.run_at).toLocaleString()})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !evalData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : !evalData || evalData.total_questions === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              No evaluation runs recorded yet. Click "Run 10-Question Eval" to benchmark the system.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead className="w-32">Retrieval Hit</TableHead>
                  <TableHead className="w-32">Citations / Status</TableHead>
                  <TableHead className="w-24 text-right">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evalData.results.map((r, i) => (
                  <TableRow key={r.id || i}>
                    <TableCell className="font-mono text-xs text-slate-400">{i + 1}</TableCell>
                    <TableCell className="space-y-1">
                      <p className="text-xs font-medium text-slate-900">{r.question}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-2 italic">
                        "{r.answer}"
                      </p>
                    </TableCell>
                    <TableCell>
                      {r.retrieval_hit ? (
                        <Badge variant="success" className="text-[10px] py-0 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Hit
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] py-0 gap-1">
                          <HelpCircle className="h-3 w-3" /> N/A
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.abstained ? (
                        <Badge variant="warning" className="text-[10px] py-0 gap-1">
                          Abstained
                        </Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {r.cited_sources.map((src, idx) => (
                            <Badge key={idx} variant="outline" className="text-[10px] py-0">
                              {src}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.passed ? (
                        <span className="inline-flex items-center text-xs font-semibold text-emerald-600 gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Pass
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-semibold text-red-600 gap-1">
                          <XCircle className="h-4 w-4" /> Fail
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
