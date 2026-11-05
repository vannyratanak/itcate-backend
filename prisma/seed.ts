import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
var optionArrayString = ["Strongly Agree", "Agree",
    "Neutral", "Disagree", "Strongly Disagree",
    "Very Satisfied", "Satisfied", "Dissatisfied", "Very Dissatisfied",
    "Very Likely", "Likely", "Unlikely", "Very Unlikely",
];
var optionBigOption = [
    ["Strongly Agree", "Agree", "Neutral", "Disagree", "Strongly Disagree"],
    ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"],
    ["Very Likely", "Likely", "Neutral", "Unlikely", "Very Unlikely",]
];
var groupOption = ["Agree", "Satisfy", "Like"]
let menu = [["The menu was easy to read", "My order was taken promptly",
    "My order was taken correctly", "My order was prepared & served promptly",
    "My order was prepared & served correcty", "The food tasted good", "The food was reasonably priced",
    "Employees were polite", "The restaurant was clean", "Napkin and sauces were freely available",
    "There was sufficient seating available"], ["Overall, how satisfied were you with your visit?"],
["How likely are you to dine with us again?"],]
async function createOption() {
    let newData = optionArrayString.map((value, index) => {
        return { name_en: value };
    });
    const option = await prisma.option.createMany({ data: newData, skipDuplicates: true })
}

async function createBigOption() {
    for (const [index, value] of groupOption.entries()) {
        const option = await prisma.groupOption.create({ data: { name: value } });
        const result = [];
        for (const val of optionBigOption[index]) {
            result.push({ option_id: (await prisma.option.findFirst({ where: { name_en: val } })).id, group_option_id: option.id });
        }
        await prisma.groupOptionWithOption.createMany({ data: result });
    }
}

// Khmer text: Google Translate output, hand-corrected where it was wrong (e.g. "Very Unlikely", "napkin").
const optionKh: Record<string, string> = {
    "Strongly Agree": "យល់ស្របយ៉ាងខ្លាំង",
    "Agree": "យល់ព្រម",
    "Neutral": "អព្យាក្រឹត",
    "Disagree": "មិនយល់ស្រប",
    "Strongly Disagree": "មិនយល់ស្របយ៉ាងខ្លាំង",
    "Very Satisfied": "ពេញចិត្តណាស់",
    "Satisfied": "ពេញចិត្ត",
    "Dissatisfied": "មិនពេញចិត្ត",
    "Very Dissatisfied": "មិនពេញចិត្តខ្លាំងណាស់",
    "Very Likely": "ទំនងណាស់",
    "Likely": "ទំនង",
    "Unlikely": "មិនទំនង",
    "Very Unlikely": "មិនទំនងខ្លាំងណាស់",
};
const questionKh: Record<string, string> = {
    "The menu was easy to read": "ម៉ឺនុយគឺងាយស្រួលអាន",
    "My order was taken promptly": "ការបញ្ជាទិញរបស់ខ្ញុំត្រូវបានទទួលយកភ្លាមៗ",
    "My order was taken correctly": "ការបញ្ជាទិញរបស់ខ្ញុំត្រូវបានទទួលយ៉ាងត្រឹមត្រូវ",
    "My order was prepared & served promptly": "ការបញ្ជាទិញរបស់ខ្ញុំត្រូវបានរៀបចំ និងបម្រើភ្លាមៗ",
    "My order was prepared & served correcty": "ការបញ្ជាទិញរបស់ខ្ញុំត្រូវបានរៀបចំ និងបម្រើយ៉ាងត្រឹមត្រូវ",
    "The food tasted good": "អាហារមានរសជាតិឆ្ងាញ់",
    "The food was reasonably priced": "អាហារមានតម្លៃសមរម្យ",
    "Employees were polite": "បុគ្គលិកមានភាពគួរសម",
    "The restaurant was clean": "ភោជនីយដ្ឋានស្អាត",
    "Napkin and sauces were freely available": "កន្សែងជូតមាត់ និងទឹកជ្រលក់មានគ្រប់គ្រាន់",
    "There was sufficient seating available": "មានកន្លែងអង្គុយគ្រប់គ្រាន់",
    "Overall, how satisfied were you with your visit?": "សរុបមក តើអ្នកពេញចិត្តចំពោះការមកលេងរបស់អ្នកកម្រិតណា?",
    "How likely are you to dine with us again?": "តើអ្នកទំនងជាមកញ៉ាំអាហារជាមួយយើងម្ដងទៀតកម្រិតណា?",
};
async function fillKhmer() {
    for (const [name_en, name_kh] of Object.entries(optionKh)) await prisma.option.updateMany({ where: { name_en, name_kh: null }, data: { name_kh } });
    for (const [name_en, name_kh] of Object.entries(questionKh)) await prisma.menuQuestion.updateMany({ where: { name_en, name_kh: null }, data: { name_kh } });
}
async function main() {
    await createOption();
    await createBigOption();
    for (const [index, value] of menu.entries()) {
        for (const val of value) {
            await prisma.menuQuestion.create({ data: { name_en: val, group_option_id: index + 1 } });
        }
    }
    await fillKhmer();
}
main().then(async () => {
    await prisma.$disconnect();
}).catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
})