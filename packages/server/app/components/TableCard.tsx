import { Equal, EqualNot, ExternalLink } from "lucide-react";
import type { FilterOp } from "~/lib/types";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";

type CountByProperty = [string, string, string?][];

function calculateCountPercentages(countByProperty: CountByProperty) {
    const totalCount = countByProperty.reduce(
        (sum, row) => sum + parseInt(row[1]),
        0,
    );

    return countByProperty.map((row) => {
        const count = parseInt(row[1]);
        const percentage = ((count / totalCount) * 100).toFixed(2);
        return `${percentage}%`;
    });
}

function FilterIconButtons({
    onInclude,
    onExclude,
}: {
    onInclude: () => void;
    onExclude: () => void;
}) {
    return (
        <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
                type="button"
                onClick={onInclude}
                aria-label="Include in filter"
                title="Include"
                className="p-1 rounded hover:bg-muted"
            >
                <Equal size={14} />
            </button>
            <button
                type="button"
                onClick={onExclude}
                aria-label="Exclude from filter"
                title="Exclude"
                className="p-1 rounded hover:bg-muted"
            >
                <EqualNot size={14} />
            </button>
        </span>
    );
}

export default function TableCard({
    countByProperty,
    columnHeaders,
    onClick,
    labelFormatter,
}: {
    countByProperty: CountByProperty;
    columnHeaders: string[];
    onClick?: (key: string, op: FilterOp) => void;
    labelFormatter?: (label: string) => string;
}) {
    const barChartPercentages = calculateCountPercentages(countByProperty);

    const countFormatter = Intl.NumberFormat("en", { notation: "compact" });

    const gridCols =
        (columnHeaders || []).length === 3
            ? "grid-cols-[minmax(0,1fr),minmax(0,8ch),minmax(0,8ch)]"
            : "grid-cols-[minmax(0,1fr),minmax(0,8ch)]";

    return (
        <Table>
            <TableHeader>
                <TableRow className={`${gridCols}`}>
                    {(columnHeaders || []).map((header: string, index) => (
                        <TableHead
                            key={header}
                            className={
                                index === 0
                                    ? "text-left"
                                    : "text-right pr-4 pl-0"
                            }
                        >
                            {header}
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {(countByProperty || []).map((item, index) => {
                    const desc = item[0];

                    // the description can be either a single string (that is both the key and the label),
                    // or a tuple of type [key, label]
                    const [key, label] = Array.isArray(desc)
                        ? [desc[0], desc[1] || "(unknown)"]
                        : [desc, desc || "(unknown)"];

                    const formattedLabel =
                        labelFormatter && typeof label === "string"
                            ? labelFormatter(label)
                            : label;

                    return (
                        <TableRow
                            key={key}
                            className={`group [&_td]:last:rounded-b-md ${gridCols}`}
                            width={barChartPercentages[index]}
                        >
                            <TableCell className="overflow-hidden font-medium min-w-48 whitespace-normal relative flex items-center justify-start gap-2">
                                {/^https?:\/\//.test(label) ? (
                                    <>
                                        <img
                                            src={`/favicon?url=${encodeURIComponent(label)}`}
                                            alt="Favicon"
                                            className="w-5 h-5 mr-1 bg-white p-0.5 rounded-full"
                                            onError={(e) => {
                                                // Fallback to external link icon if favicon fails to load
                                                const target =
                                                    e.target as HTMLImageElement;
                                                target.style.display = "none";
                                            }}
                                        />
                                        {onClick ? (
                                            <button
                                                onClick={() =>
                                                    onClick(
                                                        key as string,
                                                        "eq",
                                                    )
                                                }
                                                className="hover:underline select-text text-left truncate"
                                            >
                                                {formattedLabel}
                                            </button>
                                        ) : (
                                            formattedLabel
                                        )}
                                        <a
                                            href={label}
                                            target={"_blank"}
                                            rel="noreferrer"
                                            aria-hidden="true"
                                            className="inline whitespace-nowrap ml-1"
                                        >
                                            <ExternalLink size={16} />
                                        </a>
                                        {onClick && (
                                            <FilterIconButtons
                                                onInclude={() =>
                                                    onClick(
                                                        key as string,
                                                        "eq",
                                                    )
                                                }
                                                onExclude={() =>
                                                    onClick(
                                                        key as string,
                                                        "ne",
                                                    )
                                                }
                                            />
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {onClick ? (
                                            <button
                                                onClick={() =>
                                                    onClick(
                                                        key as string,
                                                        "eq",
                                                    )
                                                }
                                                className="hover:underline select-text text-left truncate"
                                            >
                                                {formattedLabel}
                                            </button>
                                        ) : (
                                            formattedLabel
                                        )}
                                        {onClick && (
                                            <FilterIconButtons
                                                onInclude={() =>
                                                    onClick(
                                                        key as string,
                                                        "eq",
                                                    )
                                                }
                                                onExclude={() =>
                                                    onClick(
                                                        key as string,
                                                        "ne",
                                                    )
                                                }
                                            />
                                        )}
                                    </>
                                )}
                            </TableCell>

                            <TableCell className="text-right min-w-16">
                                {countFormatter.format(parseInt(item[1], 10))}
                            </TableCell>

                            {item.length > 2 && item[2] !== undefined && (
                                <TableCell className="text-right min-w-16">
                                    {countFormatter.format(
                                        parseInt(item[2], 10),
                                    )}
                                </TableCell>
                            )}
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}
