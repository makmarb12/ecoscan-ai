
import { pipeline } from "@huggingface/transformers";

async function main() {
    console.log("Loading AI image model...");

    const classifier = await pipeline(
        "image-classification",
        "Xenova/vit-base-patch16-224"
    );

    const imageUrl =
        "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/cats.png";

    console.log("Testing image classification...");

    const results = await classifier(imageUrl);

    console.log("Model results:");
    console.log(results);
}

main().catch((error) => {
    console.error("Model test failed:", error);
});
