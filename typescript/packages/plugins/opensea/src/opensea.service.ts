import { Tool } from "@goat-sdk/core";
import { z } from "zod";
import {
    GetNftCollectionStatisticsParametersSchema,
    GetNftCollectionStatisticsResponseSchema,
    GetNftSalesParametersSchema,
    GetNftSalesResponseSchema,
} from "./parameters";

export class OpenseaService {
    constructor(private readonly apiKey: string) {}

    @Tool({
        description: "Get NFT collection statistics",
    })
    async getNftCollectionStatistics(parameters: GetNftCollectionStatisticsParametersSchema) {
        let nftCollectionStatistics: z.infer<typeof GetNftCollectionStatisticsResponseSchema>;
        try {
            const response = await fetch(
                `https://api.opensea.io/api/v2/collections/${encodeURIComponent(parameters.collectionSlug)}/stats`,
                {
                    headers: {
                        accept: "application/json",
                        "x-api-key": this.apiKey,
                    },
                },
            );

            if (!response.ok) {
                throw new Error(`OpenSea API error: ${response.status} ${response.statusText}`);
            }

            nftCollectionStatistics = (await response.json()) as z.infer<
                typeof GetNftCollectionStatisticsResponseSchema
            >;
        } catch (error) {
            throw new Error(`Failed to get NFT collection statistics: ${error}`);
        }

        return nftCollectionStatistics;
    }

    @Tool({
        description: "Get recent NFT Sales",
    })
    async getNftSales(parameters: GetNftSalesParametersSchema) {
        let nftSales: z.infer<typeof GetNftSalesResponseSchema>;
        try {
            const response = await fetch(
                `https://api.opensea.io/api/v2/events/collection/${encodeURIComponent(parameters.collectionSlug)}?event_type=sale&limit=5`,
                {
                    headers: {
                        accept: "application/json",
                        "x-api-key": this.apiKey,
                    },
                },
            );

            if (!response.ok) {
                throw new Error(`OpenSea API error: ${response.status} ${response.statusText}`);
            }

            nftSales = (await response.json()) as z.infer<typeof GetNftSalesResponseSchema>;
        } catch (error) {
            throw new Error(`Failed to get NFT sales: ${error}`);
        }

        if (!nftSales?.asset_events || !Array.isArray(nftSales.asset_events)) {
            return [];
        }

        return nftSales.asset_events.map((event) => {
            const quantity = event.payment?.quantity ?? "0";
            const decimals = event.payment?.decimals ?? 18;
            return {
                name: event.nft?.name ?? "Unknown",
                seller: event.seller ?? "Unknown",
                buyer: event.buyer ?? "Unknown",
                price: Number(BigInt(quantity)) / 10 ** decimals,
            };
        });
    }
}
