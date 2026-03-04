import { HelpCircle } from 'lucide-react';
import { PageDetails } from '../../api';

export const ContentTab = ({ details }: { details: PageDetails }) => {
    const { content, identity } = details;

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Content Analysis</h2>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <ContentRow
                        label="Page Title"
                        value={identity.title?.value || 'Not Extracted'}
                        meta={identity.title?.value ? `${identity.title.length} chars` : undefined}
                        status={identity.title?.status === 'ok' ? 'good' : (identity.title?.status === 'missing' ? 'warning' : 'warning')}
                        tooltip="The <title> tag value. Critical for relevance and click-through rates."
                    />
                    <ContentRow
                        label="Meta Description"
                        value={identity.metaDescription?.value || 'Not Extracted'}
                        meta={identity.metaDescription?.value ? `${identity.metaDescription.length} chars` : undefined}
                        status={identity.metaDescription?.status === 'ok' ? 'good' : (identity.metaDescription?.status === 'missing' ? 'warning' : 'warning')}
                        tooltip="The <meta name='description'> tag. influences snippets in search results."
                    />
                    <ContentRow
                        label="H1 Heading"
                        value={identity.h1?.count > 0 ? (identity.h1.status === 'ok' ? 'Correct' : identity.h1.status) : 'Missing'}
                        meta={identity.h1?.count ? `${identity.h1.count} tag(s)` : undefined}
                        status={identity.h1?.status === 'ok' ? 'good' : 'warning'}
                        tooltip="The primary heading of the page structure."
                    />
                </div>

                <div className="space-y-6">
                    <ContentRow
                        label="Word Count"
                        value={content.wordCount}
                        tooltip="Total visible textual content extracted from the page. Low word count may indicate thin or low-value content."
                    />
                    <ContentRow
                        label="Text-to-HTML Ratio"
                        value={content.textHtmlRatio ? `${(content.textHtmlRatio * 100).toFixed(1)}%` : 'N/A'}
                        tooltip="Ratio of text content to HTML code size. Higher is generally better for crawl efficiency."
                    />
                    <ContentRow
                        label="Unique Sentences"
                        value={content.uniqueSentenceCount ?? 'N/A'}
                        tooltip="Number of unique non-templated sentences found."
                    />
                    <ContentRow
                        label="Semantic Health"
                        value={details.health.status}
                        status={details.health.status === 'Good' ? 'good' : 'warning'}
                        tooltip="Overall evaluation of content quality and SEO health."
                    />
                </div>
            </div>

            {details.headingData && details.headingData.map && details.headingData.map.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-800">
                    <div className="p-6 bg-slate-50 dark:bg-slate-900/50">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Heading Structure</h3>
                            <span className={`text-xs font-bold px-2 py-1 rounded ${details.headingData.status === 'Healthy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                details.headingData.status === 'Moderate' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                {details.headingData.status} Score: {details.headingData.score}
                            </span>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-3 font-mono text-sm max-h-[400px] overflow-y-auto">
                            {details.headingData.map.map((node: any, idx: number) => (
                                <div key={idx} className="flex gap-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors pr-4" style={{ paddingLeft: `${(node.level - 1) * 1.5 + 1}rem` }}>
                                    <span className="text-blue-500 dark:text-blue-400 font-bold shrink-0 w-6">H{node.level}</span>
                                    <span className="text-slate-700 dark:text-slate-300 text-sm whitespace-normal" title={node.text}>
                                        {node.text}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {details.headingData.issues && details.headingData.issues.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Structural Issues Found</h4>
                                <ul className="space-y-2">
                                    {details.headingData.issues.map((issue: string, idx: number) => (
                                        <li key={idx} className="text-amber-700 dark:text-amber-400 text-sm flex items-start gap-2 bg-amber-50 dark:bg-amber-900/10 p-2 rounded border border-amber-100 dark:border-amber-900/20">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></div>
                                            <span>{issue}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const ContentRow = ({ label, value, meta, status, tooltip }: { label: string, value: string | number, meta?: string, status?: 'good' | 'warning', tooltip: string }) => (
    <div className="group">
        <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
            <div className="relative cursor-help">
                <HelpCircle size={12} className="text-slate-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    <div className="font-bold mb-1">{label}</div>
                    <div className="opacity-90 leading-relaxed">{tooltip}</div>
                    <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                </div>
            </div>
        </div>
        <div className="flex items-baseline gap-3">
            <div className={`text-base font-semibold ${status === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-200'} break-words`}>
                {value}
            </div>
            {meta && <div className="text-xs font-mono text-slate-400">{meta}</div>}
        </div>
    </div>
);
